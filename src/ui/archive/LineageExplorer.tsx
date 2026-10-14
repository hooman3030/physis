import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from 'react'
import {
  getLineagePreview,
  ControlApiError,
  type CodeNodeRecord,
  type ImprintRecord,
  type PreviewKind,
  type PresenceSnapshot,
} from '../../controlClient'
import { reportApplicationError } from '../../errorNotifications'
import {
  createLineageGraph,
  layoutLineageGraph,
  type LineageGraphEdge,
  type LineageGraphNode,
} from './lineageGraph'

export type LineageSelection = {
  kind: 'code' | 'imprint'
  id: string
}

type LineageExplorerProps = {
  codeNodes: readonly CodeNodeRecord[]
  imprints: readonly ImprintRecord[]
  presence: PresenceSnapshot | null
  selection: LineageSelection | null
  controlStatus: 'connecting' | 'connected' | 'offline'
  loading: boolean
  loadFailed: boolean
  authenticationRequired: boolean
  onSelect: (selection: LineageSelection) => void
  onActivate: (selection: LineageSelection) => void
  onRetry: () => void
}

function selectionForNode(node: LineageGraphNode): LineageSelection {
  return { kind: node.kind, id: node.id }
}

function isSelected(selection: LineageSelection | null, node: LineageGraphNode): boolean {
  return selection?.kind === node.kind && selection.id === node.id
}

function isActive(node: LineageGraphNode, presence: PresenceSnapshot | null): boolean {
  return node.kind === 'code' ? presence?.code?.id === node.id : presence?.imprint?.id === node.id
}

function nodeLabel(node: LineageGraphNode): string {
  if (node.role === 'seed') return 'Seed'
  if (node.role === 'mutation') return 'Mutation'
  return 'Imprint'
}

function displayId(id: string): string {
  return id.length > 22 ? `${id.slice(0, 19)}...` : id
}

function graphEdgePath(
  edge: LineageGraphEdge,
  positions: ReadonlyMap<string, { x: number; y: number }>,
) {
  const from = positions.get(edge.from)
  const to = positions.get(edge.to)
  if (from === undefined || to === undefined) return ''

  if (edge.kind === 'code-reference') {
    const middleY = (from.y + to.y) / 2
    return `M ${from.x} ${from.y - 42} C ${from.x} ${middleY}, ${to.x} ${middleY}, ${to.x} ${to.y + 42}`
  }

  const startX = from.x + 42
  const endX = to.x - 42
  const controlGap = Math.max(28, (endX - startX) / 2)
  return `M ${startX} ${from.y} C ${startX + controlGap} ${from.y}, ${endX - controlGap} ${to.y}, ${endX} ${to.y}`
}

function graphEdgeLabel(
  edge: LineageGraphEdge,
  nodesByKey: ReadonlyMap<string, LineageGraphNode>,
): string {
  const from = nodesByKey.get(edge.from)
  const to = nodesByKey.get(edge.to)
  const label =
    edge.kind === 'code-parent'
      ? 'Code parent'
      : edge.kind === 'imprint-parent'
        ? 'Imprint parent'
        : 'Code reference'
  return `${label}: ${from?.id ?? edge.from} to ${to?.id ?? edge.to}`
}

function handleNodeKeyDown(
  event: KeyboardEvent<SVGGElement>,
  node: LineageGraphNode,
  onSelect: (selection: LineageSelection) => void,
) {
  if (event.key !== 'Enter' && event.key !== ' ') return
  event.preventDefault()
  onSelect(selectionForNode(node))
}

function usePreviewUrl(kind: PreviewKind, id: string): string | null {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  useEffect(() => {
    let disposed = false
    let objectUrl: string | null = null
    setPreviewUrl(null)
    void getLineagePreview(kind, id)
      .then((preview) => {
        if (disposed || preview === null) return
        objectUrl = URL.createObjectURL(preview)
        setPreviewUrl(objectUrl)
      })
      .catch((error: unknown) => {
        if (disposed) return
        if (error instanceof ControlApiError && error.status === 401) return
        reportApplicationError(
          `Could not load the preview for ${id}: ${error instanceof Error ? error.message : String(error)}`,
        )
      })

    return () => {
      disposed = true
      if (objectUrl !== null) URL.revokeObjectURL(objectUrl)
    }
  }, [id, kind])

  return previewUrl
}

function useAnimationUrl(
  kind: PreviewKind,
  id: string,
  active: boolean,
  reducedMotion: boolean,
): string | null {
  const [animationUrl, setAnimationUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!active || reducedMotion) {
      setAnimationUrl(null)
      return
    }
    let disposed = false
    let objectUrl: string | null = null
    void getLineagePreview(kind, id, 'animation')
      .then((animation) => {
        if (disposed || animation === null) return
        objectUrl = URL.createObjectURL(animation)
        setAnimationUrl(objectUrl)
      })
      .catch((error: unknown) => {
        if (disposed || (error instanceof ControlApiError && error.status === 401)) return
        reportApplicationError(
          `Could not load the animation for ${id}: ${error instanceof Error ? error.message : String(error)}`,
        )
      })

    return () => {
      disposed = true
      if (objectUrl !== null) URL.revokeObjectURL(objectUrl)
    }
  }, [active, id, kind, reducedMotion])

  return animationUrl
}

function usePrefersReducedMotion(): boolean {
  const [reducedMotion, setReducedMotion] = useState(
    () =>
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReducedMotion(query.matches)
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  return reducedMotion
}

function LineageNode({
  node,
  position,
  active,
  selected,
  animationActive,
  reducedMotion,
  onSelect,
  onAnimationStart,
  onAnimationStop,
  onTouchAnimation,
}: {
  node: LineageGraphNode
  position: { x: number; y: number }
  active: boolean
  selected: boolean
  animationActive: boolean
  reducedMotion: boolean
  onSelect: (selection: LineageSelection) => void
  onAnimationStart: (key: string) => void
  onAnimationStop: (key: string) => void
  onTouchAnimation: (key: string) => void
}) {
  const label = nodeLabel(node)
  const previewUrl = usePreviewUrl(node.kind, node.id)
  const animationUrl = useAnimationUrl(node.kind, node.id, animationActive, reducedMotion)
  const imageUrl = animationActive && !reducedMotion ? (animationUrl ?? previewUrl) : previewUrl
  const pointerKey = node.key
  const clipId = `lineage-preview-clip-${useId().replace(/:/g, '')}`
  const accessibleLabel = `${label} ${node.id}${active ? ', active Presence' : ''}${node.kind === 'code' && !node.available ? ', unavailable in this build' : ''}${previewUrl === null && animationUrl === null ? ', no saved preview' : ', saved preview available'}`
  const shapeClass = `lineage-graph-shape lineage-graph-shape-${node.role}`
  const handlePointerEnter = (event: PointerEvent<SVGGElement>) => {
    if (event.pointerType !== 'touch') onAnimationStart(pointerKey)
  }
  const handlePointerLeave = (event: PointerEvent<SVGGElement>) => {
    if (event.pointerType !== 'touch' && !event.currentTarget.matches(':focus')) {
      onAnimationStop(pointerKey)
    }
  }

  return (
    <g
      className={`lineage-graph-node${active ? ' lineage-graph-node-active' : ''}${selected ? ' lineage-graph-node-selected' : ''}`}
      role="button"
      tabIndex={0}
      aria-label={accessibleLabel}
      aria-pressed={selected}
      transform={`translate(${position.x} ${position.y})`}
      onClick={() => onSelect(selectionForNode(node))}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onPointerUp={(event) => {
        if (event.pointerType === 'touch') onTouchAnimation(pointerKey)
      }}
      onFocus={() => onAnimationStart(pointerKey)}
      onBlur={(event) => {
        if (!event.currentTarget.matches(':hover')) onAnimationStop(pointerKey)
      }}
      onKeyDown={(event) => handleNodeKeyDown(event, node, onSelect)}
    >
      <title>{accessibleLabel}</title>
      {active && <circle className="lineage-graph-active-ring" r="49" />}
      {selected && <circle className="lineage-graph-selected-ring" r="44" />}
      <circle className={shapeClass} r="37" />
      {imageUrl === null ? (
        <text className="lineage-graph-glyph" y="6" aria-hidden="true">
          {node.role === 'seed' ? 'S' : node.role === 'mutation' ? 'M' : 'I'}
        </text>
      ) : (
        <>
          <defs>
            <clipPath id={clipId} clipPathUnits="userSpaceOnUse">
              <circle r="34" />
            </clipPath>
          </defs>
          <image
            className="lineage-graph-preview"
            href={imageUrl}
            x="-34"
            y="-34"
            width="68"
            height="68"
            preserveAspectRatio="xMidYMid slice"
            clipPath={`url(#${clipId})`}
          />
        </>
      )}
      {node.role !== 'seed' && (
        <circle className={`lineage-graph-role-ring lineage-graph-role-ring-${node.role}`} r="35" />
      )}
      <text className="lineage-graph-type" y="59" aria-hidden="true">
        {label.toUpperCase()}
      </text>
      <text className="lineage-graph-label" y="77" aria-hidden="true">
        {displayId(node.id)}
      </text>
    </g>
  )
}

export function LineageExplorer({
  codeNodes,
  imprints,
  presence,
  selection,
  controlStatus,
  loading,
  loadFailed,
  authenticationRequired,
  onSelect,
  onActivate,
  onRetry,
}: LineageExplorerProps) {
  const graph = createLineageGraph(codeNodes, imprints)
  const layout = layoutLineageGraph(graph)
  const nodesByKey = new Map(graph.nodes.map((node) => [node.key, node]))
  const selectedNode =
    selection === null
      ? undefined
      : graph.nodes.find((node) => node.kind === selection.kind && node.id === selection.id)
  const selectedCode =
    selection?.kind === 'code' ? codeNodes.find((node) => node.id === selection.id) : undefined
  const selectedImprint =
    selection?.kind === 'imprint'
      ? imprints.find((imprint) => imprint.id === selection.id)
      : undefined
  const selectedCodeAvailable = selectedCode?.available ?? false
  const selectedImprintCodeAvailable =
    selectedImprint !== undefined &&
    codeNodes.some((node) => node.id === selectedImprint.codeId && node.available)
  const canActivate =
    controlStatus === 'connected' && (selectedCodeAvailable || selectedImprintCodeAvailable)
  const reducedMotion = usePrefersReducedMotion()
  const [activeAnimationKey, setActiveAnimationKey] = useState<string | null>(null)
  const touchAnimationTimer = useRef<number | null>(null)
  const startAnimation = useCallback(
    (key: string) => {
      if (!reducedMotion) setActiveAnimationKey(key)
    },
    [reducedMotion],
  )
  const stopAnimation = useCallback((key: string) => {
    setActiveAnimationKey((current) => (current === key ? null : current))
  }, [])
  const playTouchAnimation = useCallback(
    (key: string) => {
      startAnimation(key)
      if (touchAnimationTimer.current !== null) {
        window.clearTimeout(touchAnimationTimer.current)
      }
      touchAnimationTimer.current = window.setTimeout(() => {
        stopAnimation(key)
        touchAnimationTimer.current = null
      }, 3200)
    },
    [startAnimation, stopAnimation],
  )

  useEffect(
    () => () => {
      if (touchAnimationTimer.current !== null) window.clearTimeout(touchAnimationTimer.current)
    },
    [],
  )

  return (
    <>
      <header className="lineage-header">
        <a className="lineage-back-link" href="/">
          Back to artwork
        </a>
        <p className="eyebrow">Archive</p>
        <h1>Lineage Explorer</h1>
        <p>
          Follow code ancestry and Imprint history. Dashed links show which code an Imprint records;
          they do not imply ancestry.
        </p>
      </header>
      <p className="lineage-status" role="status">
        {authenticationRequired
          ? 'Pair this browser to access the archive.'
          : loading
            ? 'Loading the archive…'
            : loadFailed
              ? 'The archive could not be loaded.'
              : controlStatus === 'connected'
                ? `${codeNodes.length} code nodes and ${imprints.length} Imprints`
                : 'The local control API is unavailable.'}
      </p>
      {loadFailed && !authenticationRequired && (
        <button type="button" className="lineage-retry" onClick={onRetry}>
          Retry
        </button>
      )}
      {!loading && !loadFailed && !authenticationRequired && (
        <>
          {graph.nodes.length === 0 ? (
            <p className="lineage-empty">No Seeds, Mutations, or Imprints are archived.</p>
          ) : (
            <div className="lineage-browser">
              <section className="lineage-graph-panel" aria-label="Archive lineage graph">
                <div className="lineage-graph-legend" aria-label="Relationship legend">
                  <span>
                    <i
                      className="lineage-legend-line lineage-legend-code-parent"
                      aria-hidden="true"
                    />
                    Code parent
                  </span>
                  <span>
                    <i
                      className="lineage-legend-line lineage-legend-imprint-parent"
                      aria-hidden="true"
                    />
                    Imprint parent
                  </span>
                  <span>
                    <i
                      className="lineage-legend-line lineage-legend-reference"
                      aria-hidden="true"
                    />
                    Imprint-to-code reference
                  </span>
                </div>
                <div className="lineage-graph-scroll">
                  <svg
                    className="lineage-graph"
                    role="group"
                    aria-label="Lineage graph; use Tab to focus a node and Enter or Space to inspect it"
                    viewBox={`0 0 ${layout.width} ${layout.height}`}
                    width={layout.width}
                    height={layout.height}
                  >
                    <defs>
                      <marker
                        id="lineage-code-parent-arrow"
                        markerWidth="8"
                        markerHeight="8"
                        refX="7"
                        refY="4"
                        orient="auto"
                      >
                        <path d="M0 0 L8 4 L0 8 Z" className="lineage-arrow-code-parent" />
                      </marker>
                      <marker
                        id="lineage-imprint-parent-arrow"
                        markerWidth="8"
                        markerHeight="8"
                        refX="7"
                        refY="4"
                        orient="auto"
                      >
                        <path d="M0 0 L8 4 L0 8 Z" className="lineage-arrow-imprint-parent" />
                      </marker>
                      <marker
                        id="lineage-code-reference-arrow"
                        markerWidth="8"
                        markerHeight="8"
                        refX="7"
                        refY="4"
                        orient="auto"
                      >
                        <path d="M0 0 L8 4 L0 8 Z" className="lineage-arrow-reference" />
                      </marker>
                    </defs>
                    <rect
                      className="lineage-lane-band lineage-code-lane"
                      x="16"
                      y={layout.codeLane.top}
                      width={layout.width - 32}
                      height={layout.codeLane.bottom - layout.codeLane.top}
                      rx="24"
                    />
                    <rect
                      className="lineage-lane-band lineage-imprint-lane"
                      x="16"
                      y={layout.imprintLane.top}
                      width={layout.width - 32}
                      height={layout.imprintLane.bottom - layout.imprintLane.top}
                      rx="24"
                    />
                    <text className="lineage-lane-label" x="42" y={layout.codeLane.top + 30}>
                      CODE LINEAGE
                    </text>
                    <text className="lineage-lane-label" x="42" y={layout.imprintLane.top + 30}>
                      IMPRINT LINEAGE
                    </text>
                    {graph.edges.map((edge) => (
                      <path
                        key={`${edge.kind}:${edge.from}:${edge.to}`}
                        className={`lineage-graph-edge lineage-graph-edge-${edge.kind}`}
                        d={graphEdgePath(edge, layout.positions)}
                        markerEnd={`url(#lineage-${edge.kind}-arrow)`}
                        role="img"
                        aria-label={graphEdgeLabel(edge, nodesByKey)}
                      >
                        <title>{graphEdgeLabel(edge, nodesByKey)}</title>
                      </path>
                    ))}
                    {graph.nodes.map((node) => {
                      const position = layout.positions.get(node.key)
                      if (position === undefined) return null
                      return (
                        <LineageNode
                          key={node.key}
                          node={node}
                          position={position}
                          active={isActive(node, presence)}
                          selected={isSelected(selection, node)}
                          animationActive={activeAnimationKey === node.key}
                          reducedMotion={reducedMotion}
                          onSelect={onSelect}
                          onAnimationStart={startAnimation}
                          onAnimationStop={stopAnimation}
                          onTouchAnimation={playTouchAnimation}
                        />
                      )
                    })}
                  </svg>
                </div>
              </section>
              <aside
                className="lineage-inspector surface shape-panel"
                aria-label="Selected archive node"
              >
                {selectedCode !== undefined ? (
                  <>
                    <p className="eyebrow">{selectedCode.role}</p>
                    <h2>{selectedCode.id}</h2>
                    <p>Source revision: {selectedCode.sourceRevision}</p>
                    <p>Parent: {selectedCode.parentId ?? 'none (root)'}</p>
                    <p>Saved previews appear on graph nodes.</p>
                    <button
                      type="button"
                      disabled={!canActivate}
                      onClick={() => onActivate({ kind: 'code', id: selectedCode.id })}
                    >
                      Use in Presence
                    </button>
                  </>
                ) : selectedImprint !== undefined ? (
                  <>
                    <p className="eyebrow">Imprint</p>
                    <h2>{selectedImprint.id}</h2>
                    <p>Code reference: {selectedImprint.codeId}</p>
                    <p>Parent: {selectedImprint.parentId ?? 'none (root)'}</p>
                    <p>Saved previews appear on graph nodes.</p>
                    <button
                      type="button"
                      disabled={!canActivate}
                      onClick={() => onActivate({ kind: 'imprint', id: selectedImprint.id })}
                    >
                      Use in Presence
                    </button>
                  </>
                ) : (
                  <p className="lineage-inspector-empty">
                    {selectedNode === undefined
                      ? 'Select a node to inspect it.'
                      : 'This archive node is no longer available.'}
                  </p>
                )}
                {selection !== null && !canActivate && controlStatus === 'connected' && (
                  <p className="lineage-unavailable">
                    Its code is not available in this build, so it cannot be used in the Presence.
                  </p>
                )}
              </aside>
            </div>
          )}
        </>
      )}
    </>
  )
}

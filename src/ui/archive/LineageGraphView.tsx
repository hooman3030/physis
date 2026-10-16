import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import {
  getLineagePreview,
  ControlApiError,
  type PreviewKind,
  type PresenceSnapshot,
} from '../../controlClient'
import { reportApplicationError } from '../../errorNotifications'
import type { LineageSelection } from './LineageExplorer'
import {
  createInitialLineagePositions,
  graphDimensions,
  type GraphPosition,
  type LineageGraph,
  type LineageGraphNode,
} from './lineageGraph'
import { createLineageLayoutSimulation, type LineageSimulationNode } from './lineageLayout'
import { clearLineageLayout, readLineageLayout, saveLineageLayout } from './lineageLayoutStorage'

type LineageGraphViewProps = {
  graph: LineageGraph
  presence: PresenceSnapshot | null
  selection: LineageSelection | null
  canDeleteImprints: boolean
  onSelect: (selection: LineageSelection) => void
  onDeleteImprints: (imprintIds: readonly string[]) => Promise<readonly string[]>
}

type Viewport = {
  x: number
  y: number
  scale: number
}

type BackdropLayers = {
  previous: string | null
  current: string | null
}

type Gesture =
  | {
      kind: 'node'
      pointerId: number
      nodeKey: string
      startX: number
      startY: number
      moved: boolean
    }
  | {
      kind: 'pan'
      pointerId: number
      startX: number
      startY: number
      viewportX: number
      viewportY: number
      moved: boolean
    }

const DEFAULT_VIEWPORT: Viewport = { x: 0, y: 0, scale: 1 }
const MIN_ZOOM = 0.5
const MAX_ZOOM = 2.5
const DRAG_THRESHOLD = 3
const NODE_MOVE_STEP = 12
const WHEEL_ZOOM_SENSITIVITY = 0.0005
const BACKDROP_TRANSITION_DURATION = 450

export function wheelZoomFactor(deltaY: number): number {
  return Math.exp(-deltaY * WHEEL_ZOOM_SENSITIVITY)
}

function nodeLabel(node: LineageGraphNode): string {
  if (node.role === 'seed') return 'Seed'
  if (node.role === 'mutation') return 'Mutation'
  return 'Imprint'
}

function displayId(id: string): string {
  return id.length > 22 ? `${id.slice(0, 19)}...` : id
}

function isSelected(selection: LineageSelection | null, node: LineageGraphNode): boolean {
  return selection?.kind === node.kind && selection.id === node.id
}

function isActive(node: LineageGraphNode, presence: PresenceSnapshot | null): boolean {
  return node.kind === 'code' ? presence?.code?.id === node.id : presence?.imprint?.id === node.id
}

export function canDeleteLineageNode(
  node: LineageGraphNode,
  presence: PresenceSnapshot | null,
): boolean {
  return node.kind === 'imprint' && presence?.imprint?.id !== node.id
}

export function toggleDeleteSelection(selected: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(selected)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  return next
}

export function getLineageGraphSelectionAction(
  selection: LineageSelection,
  deleteMode: boolean,
  nodes: readonly LineageGraphNode[],
  presence: PresenceSnapshot | null,
):
  | { type: 'activate'; selection: LineageSelection }
  | { type: 'toggle-delete'; imprintId: string }
  | { type: 'ignore' } {
  if (!deleteMode) return { type: 'activate', selection }
  if (selection.kind !== 'imprint') return { type: 'ignore' }
  const node = nodes.find(
    (candidate) => candidate.kind === 'imprint' && candidate.id === selection.id,
  )
  return node !== undefined && canDeleteLineageNode(node, presence)
    ? { type: 'toggle-delete', imprintId: selection.id }
    : { type: 'ignore' }
}

function selectionForNode(node: LineageGraphNode): LineageSelection {
  return { kind: node.kind, id: node.id }
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

function clientPointInSvg(
  event: { clientX: number; clientY: number },
  svg: SVGSVGElement,
): GraphPosition | null {
  const matrix = svg.getScreenCTM()
  if (matrix === null) return null
  const point = svg.createSVGPoint()
  point.x = event.clientX
  point.y = event.clientY
  const result = point.matrixTransform(matrix.inverse())
  return { x: result.x, y: result.y }
}

function clientPointInGraph(
  event: { clientX: number; clientY: number },
  graphGroup: SVGGElement,
): GraphPosition | null {
  const svg = graphGroup.ownerSVGElement
  const matrix = graphGroup.getScreenCTM()
  if (svg === null || matrix === null) return null
  const point = svg.createSVGPoint()
  point.x = event.clientX
  point.y = event.clientY
  const result = point.matrixTransform(matrix.inverse())
  return { x: result.x, y: result.y }
}

function usePreviewUrl(kind: PreviewKind, id: string): { url: string | null; loaded: boolean } {
  const [preview, setPreview] = useState<{ url: string | null; loaded: boolean }>({
    url: null,
    loaded: false,
  })

  useEffect(() => {
    let disposed = false
    let objectUrl: string | null = null
    setPreview({ url: null, loaded: false })
    void getLineagePreview(kind, id)
      .then((asset) => {
        if (disposed) return
        if (asset === null) {
          setPreview({ url: null, loaded: true })
          return
        }
        objectUrl = URL.createObjectURL(asset)
        setPreview({ url: objectUrl, loaded: true })
      })
      .catch((error: unknown) => {
        if (disposed) return
        setPreview({ url: null, loaded: true })
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

  return preview
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

function GraphNode({
  node,
  position,
  active,
  selected,
  deleteMode,
  deletable,
  animationActive,
  reducedMotion,
  onSelect,
  onSelectedPreviewChange,
  onPointerDown,
  onAnimationStart,
  onAnimationStop,
  onMoveBy,
}: {
  node: LineageGraphNode
  position: GraphPosition
  active: boolean
  selected: boolean
  deleteMode: boolean
  deletable: boolean
  animationActive: boolean
  reducedMotion: boolean
  onSelect: (selection: LineageSelection) => void
  onSelectedPreviewChange: (previewUrl: string | null) => void
  onPointerDown: (event: ReactPointerEvent<SVGGElement>, key: string) => void
  onAnimationStart: (key: string) => void
  onAnimationStop: (key: string) => void
  onMoveBy: (key: string, x: number, y: number) => void
}) {
  const preview = usePreviewUrl(node.kind, node.id)
  const previewUrl = preview.url
  const animationUrl = useAnimationUrl(node.kind, node.id, animationActive, reducedMotion)
  const imageUrl = animationActive && !reducedMotion ? (animationUrl ?? previewUrl) : previewUrl
  const clipId = `lineage-preview-clip-${useId().replace(/:/g, '')}`
  const selectionDescription = deleteMode
    ? deletable
      ? selected
        ? ', selected for deletion'
        : ', available for deletion'
      : ', unavailable for deletion'
    : selected
      ? ', selected'
      : ''
  const accessibleLabel = `${nodeLabel(node)} ${node.id}${active ? ', active Presence' : ''}${selectionDescription}${node.kind === 'code' && !node.available ? ', unavailable in this build' : ''}${previewUrl === null && animationUrl === null ? ', no saved preview' : ', saved preview available'}`
  useEffect(() => {
    if (selected && preview.loaded) onSelectedPreviewChange(previewUrl)
  }, [onSelectedPreviewChange, preview.loaded, previewUrl, selected])

  const handleKeyDown = (event: ReactKeyboardEvent<SVGGElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onSelect(selectionForNode(node))
      return
    }
    const delta = event.shiftKey ? NODE_MOVE_STEP * 2 : NODE_MOVE_STEP
    const movement: Record<string, GraphPosition> = {
      ArrowLeft: { x: -delta, y: 0 },
      ArrowRight: { x: delta, y: 0 },
      ArrowUp: { x: 0, y: -delta },
      ArrowDown: { x: 0, y: delta },
    }
    const offset = movement[event.key]
    if (offset === undefined) return
    event.preventDefault()
    onMoveBy(node.key, offset.x, offset.y)
  }

  return (
    <g
      className={`lineage-graph-node lineage-graph-node-${node.role}${active ? ' lineage-graph-node-active' : ''}${selected ? ' lineage-graph-node-selected' : ''}${deleteMode ? ' lineage-graph-node-delete-mode' : ''}${deleteMode && !deletable ? ' lineage-graph-node-delete-unavailable' : ''}${deleteMode && selected ? ' lineage-graph-node-delete-selected' : ''}`}
      role="button"
      tabIndex={0}
      aria-label={accessibleLabel}
      aria-pressed={selected}
      aria-disabled={deleteMode && !deletable}
      transform={`translate(${position.x} ${position.y})${node.role === 'seed' ? ' scale(1.33)' : ''}`}
      onClick={(event) => {
        if (event.detail === 0) onSelect(selectionForNode(node))
      }}
      onPointerDown={(event) => onPointerDown(event, node.key)}
      onPointerEnter={(event) => {
        if (event.pointerType !== 'touch') onAnimationStart(node.key)
      }}
      onPointerLeave={(event) => {
        if (event.pointerType !== 'touch' && !event.currentTarget.matches(':focus')) {
          onAnimationStop(node.key)
        }
      }}
      onFocus={() => onAnimationStart(node.key)}
      onBlur={(event) => {
        if (!event.currentTarget.matches(':hover')) onAnimationStop(node.key)
      }}
      onKeyDown={handleKeyDown}
    >
      <title>{accessibleLabel}</title>
      {active && <circle className="lineage-graph-active-ring" r="51" />}
      {selected && <circle className="lineage-graph-selected-ring" r="48" />}
      <circle className={`lineage-graph-shape lineage-graph-shape-${node.role}`} r="39" />
      {imageUrl === null ? (
        <text className="lineage-graph-glyph" y="6" aria-hidden="true">
          {node.role === 'seed' ? 'S' : node.role === 'mutation' ? 'M' : 'I'}
        </text>
      ) : (
        <>
          <defs>
            <clipPath id={clipId} clipPathUnits="userSpaceOnUse">
              <circle r="36" />
            </clipPath>
          </defs>
          <image
            className="lineage-graph-preview"
            href={imageUrl}
            x="-36"
            y="-36"
            width="72"
            height="72"
            preserveAspectRatio="xMidYMid slice"
            clipPath={`url(#${clipId})`}
          />
        </>
      )}
      <text className="lineage-graph-type" y="60" aria-hidden="true">
        {nodeLabel(node).toUpperCase()}
      </text>
      <text className="lineage-graph-label" y="78" aria-hidden="true">
        {displayId(node.id)}
      </text>
    </g>
  )
}

export function LineageGraphView({
  graph,
  presence,
  selection,
  canDeleteImprints,
  onSelect,
  onDeleteImprints,
}: LineageGraphViewProps) {
  const reducedMotion = usePrefersReducedMotion()
  const dimensions = useMemo(() => graphDimensions(graph.nodes.length), [graph.nodes.length])
  const initialPositions = useMemo(
    () => createInitialLineagePositions(graph.nodes, dimensions, new Map(), graph.edges),
    [dimensions, graph],
  )
  const [positions, setPositions] = useState(initialPositions)
  const [viewport, setViewport] = useState(DEFAULT_VIEWPORT)
  const [layoutRevision, setLayoutRevision] = useState(0)
  const [activeAnimationKey, setActiveAnimationKey] = useState<string | null>(null)
  const [selectedPreviewUrl, setSelectedPreviewUrl] = useState<string | null>(null)
  const [deleteMode, setDeleteMode] = useState(false)
  const [deleteSelection, setDeleteSelection] = useState<ReadonlySet<string>>(() => new Set())
  const [deleteRequestPending, setDeleteRequestPending] = useState(false)
  const [backdropLayers, setBackdropLayers] = useState<BackdropLayers>({
    previous: null,
    current: null,
  })
  const svgRef = useRef<SVGSVGElement | null>(null)
  const graphGroupRef = useRef<SVGGElement | null>(null)
  const gestureRef = useRef<Gesture | null>(null)
  const positionsRef = useRef(positions)
  const simulationRef = useRef<ReturnType<typeof createLineageLayoutSimulation>['simulation']>(null)
  const nodesByKeyRef = useRef(new Map<string, LineageSimulationNode>())
  const persistOnEndRef = useRef(false)
  const touchAnimationTimer = useRef<number | null>(null)
  const backdropCurrentUrlRef = useRef<string | null>(null)

  const publishPositions = useCallback(
    (nodes: Iterable<LineageSimulationNode> = nodesByKeyRef.current.values()) => {
      const next = new Map<string, GraphPosition>()
      for (const node of nodes) {
        if (node.x !== undefined && node.y !== undefined) {
          next.set(node.key, { x: node.x, y: node.y })
        }
      }
      positionsRef.current = next
      setPositions(next)
    },
    [],
  )

  const saveCurrentPositions = useCallback(() => {
    saveLineageLayout(positionsRef.current)
    persistOnEndRef.current = false
  }, [])

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

  useEffect(() => {
    const validKeys = new Set(graph.nodes.map((node) => node.key))
    const savedPositions = readLineageLayout(validKeys)
    const { nodes, simulation } = createLineageLayoutSimulation(graph, dimensions, savedPositions)
    nodesByKeyRef.current = new Map(nodes.map((node) => [node.key, node]))
    simulationRef.current = simulation
    persistOnEndRef.current = nodes.length > 0
    publishPositions(nodes)

    let frame: number | null = null
    const updateAfterTick = () => {
      if (frame !== null) return
      frame = window.requestAnimationFrame(() => {
        frame = null
        publishPositions(nodes)
      })
    }
    const finishSimulation = () => {
      if (frame !== null) {
        window.cancelAnimationFrame(frame)
        frame = null
      }
      publishPositions(nodes)
      if (persistOnEndRef.current) saveCurrentPositions()
    }

    simulation.on('tick', updateAfterTick).on('end', finishSimulation)
    if (reducedMotion) {
      simulation.stop()
      simulation.tick(140)
      publishPositions(nodes)
      if (persistOnEndRef.current) saveCurrentPositions()
    } else {
      simulation.restart()
    }

    return () => {
      simulation.stop()
      simulation.on('tick', null).on('end', null)
      if (frame !== null) window.cancelAnimationFrame(frame)
      if (simulationRef.current === simulation) simulationRef.current = null
    }
  }, [dimensions, graph, layoutRevision, publishPositions, reducedMotion, saveCurrentPositions])

  useEffect(
    () => () => {
      if (touchAnimationTimer.current !== null) window.clearTimeout(touchAnimationTimer.current)
    },
    [],
  )

  const pointInSvg = useCallback((event: { clientX: number; clientY: number }) => {
    const svg = svgRef.current
    return svg === null ? null : clientPointInSvg(event, svg)
  }, [])

  const pointInGraph = useCallback((event: { clientX: number; clientY: number }) => {
    const graphGroup = graphGroupRef.current
    return graphGroup === null ? null : clientPointInGraph(event, graphGroup)
  }, [])

  const onNodePointerDown = useCallback(
    (event: ReactPointerEvent<SVGGElement>, nodeKey: string) => {
      if (event.button !== 0 || svgRef.current === null) return
      event.preventDefault()
      event.stopPropagation()
      gestureRef.current = {
        kind: 'node',
        pointerId: event.pointerId,
        nodeKey,
        startX: event.clientX,
        startY: event.clientY,
        moved: false,
      }
      svgRef.current.setPointerCapture(event.pointerId)
    },
    [],
  )

  const onBackgroundPointerDown = useCallback(
    (event: ReactPointerEvent<SVGSVGElement>) => {
      if (event.button !== 0) return
      const point = pointInSvg(event)
      if (point === null) return
      gestureRef.current = {
        kind: 'pan',
        pointerId: event.pointerId,
        startX: point.x,
        startY: point.y,
        viewportX: viewport.x,
        viewportY: viewport.y,
        moved: false,
      }
      event.currentTarget.setPointerCapture(event.pointerId)
    },
    [pointInSvg, viewport.x, viewport.y],
  )

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<SVGSVGElement>) => {
      const gesture = gestureRef.current
      if (gesture === null || gesture.pointerId !== event.pointerId) return
      if (gesture.kind === 'pan') {
        const point = pointInSvg(event)
        if (point === null) return
        if (
          !gesture.moved &&
          Math.hypot(point.x - gesture.startX, point.y - gesture.startY) > DRAG_THRESHOLD
        ) {
          gesture.moved = true
        }
        if (gesture.moved) {
          setViewport((current) => ({
            ...current,
            x: gesture.viewportX + point.x - gesture.startX,
            y: gesture.viewportY + point.y - gesture.startY,
          }))
        }
        return
      }

      const node = nodesByKeyRef.current.get(gesture.nodeKey)
      const point = pointInGraph(event)
      if (node === undefined || point === null) return
      if (
        !gesture.moved &&
        Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY) > DRAG_THRESHOLD
      ) {
        gesture.moved = true
        node.fx = node.x
        node.fy = node.y
        simulationRef.current?.alphaTarget(0.16).restart()
      }
      if (gesture.moved) {
        node.fx = point.x
        node.fy = point.y
        node.x = point.x
        node.y = point.y
        publishPositions()
      }
    },
    [pointInGraph, pointInSvg, publishPositions],
  )

  const handleNodeSelect = useCallback(
    (nextSelection: LineageSelection) => {
      const action = getLineageGraphSelectionAction(
        nextSelection,
        deleteMode,
        graph.nodes,
        presence,
      )
      if (action.type === 'activate') onSelect(action.selection)
      if (action.type === 'toggle-delete') {
        setDeleteSelection((current) => toggleDeleteSelection(current, action.imprintId))
      }
    },
    [deleteMode, graph.nodes, onSelect, presence],
  )

  const finishGesture = useCallback(
    (event: ReactPointerEvent<SVGSVGElement>, cancelled: boolean) => {
      const gesture = gestureRef.current
      if (gesture === null || gesture.pointerId !== event.pointerId) return
      gestureRef.current = null
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }

      if (gesture.kind === 'pan') return
      const node = nodesByKeyRef.current.get(gesture.nodeKey)
      if (node === undefined) return
      if (!gesture.moved) {
        if (!cancelled) {
          handleNodeSelect(selectionForNode(node))
          if (event.pointerType === 'touch') playTouchAnimation(node.key)
        }
        return
      }

      node.fx = node.x
      node.fy = node.y
      persistOnEndRef.current = true
      simulationRef.current?.alphaTarget(0).restart()
      if (reducedMotion) {
        simulationRef.current?.stop()
        publishPositions()
        saveCurrentPositions()
      }
    },
    [handleNodeSelect, playTouchAnimation, publishPositions, reducedMotion, saveCurrentPositions],
  )

  const onNodeMoveBy = useCallback(
    (key: string, x: number, y: number) => {
      const node = nodesByKeyRef.current.get(key)
      if (node === undefined) return
      node.fx = (node.x ?? dimensions.width / 2) + x
      node.fy = (node.y ?? dimensions.height / 2) + y
      node.x = node.fx
      node.y = node.fy
      persistOnEndRef.current = true
      publishPositions()
      if (reducedMotion) {
        simulationRef.current?.stop()
        saveCurrentPositions()
      } else {
        simulationRef.current?.alpha(0.35).alphaTarget(0).restart()
      }
    },
    [dimensions.height, dimensions.width, publishPositions, reducedMotion, saveCurrentPositions],
  )

  const zoomAround = useCallback((factor: number, anchor: GraphPosition) => {
    setViewport((current) => {
      const scale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, current.scale * factor))
      if (scale === current.scale) return current
      const worldX = (anchor.x - current.x) / current.scale
      const worldY = (anchor.y - current.y) / current.scale
      return { x: anchor.x - worldX * scale, y: anchor.y - worldY * scale, scale }
    })
  }, [])

  useEffect(() => {
    const svg = svgRef.current
    if (svg === null) return
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault()
      const anchor = pointInSvg(event)
      if (anchor === null) return
      zoomAround(wheelZoomFactor(event.deltaY), anchor)
    }
    svg.addEventListener('wheel', handleWheel, { passive: false })
    return () => svg.removeEventListener('wheel', handleWheel)
  }, [pointInSvg, zoomAround])

  const handleResetLayout = useCallback(() => {
    clearLineageLayout()
    setViewport(DEFAULT_VIEWPORT)
    setLayoutRevision((revision) => revision + 1)
  }, [])

  const zoomAtCenter = useCallback(
    (factor: number) => zoomAround(factor, { x: dimensions.width / 2, y: dimensions.height / 2 }),
    [dimensions.height, dimensions.width, zoomAround],
  )

  const positionFor = useCallback(
    (node: LineageGraphNode) =>
      positions.get(node.key) ?? initialPositions.get(node.key) ?? { x: 0, y: 0 },
    [initialPositions, positions],
  )

  const nodesByKey = useMemo(() => new Map(graph.nodes.map((node) => [node.key, node])), [graph])

  useEffect(() => {
    if (!deleteMode) return
    const deletableIds = new Set(
      graph.nodes.filter((node) => canDeleteLineageNode(node, presence)).map((node) => node.id),
    )
    setDeleteSelection((current) => {
      const next = new Set([...current].filter((id) => deletableIds.has(id)))
      return next.size === current.size ? current : next
    })
  }, [deleteMode, graph.nodes, presence?.imprint?.id])

  const handleToggleDeleteMode = useCallback(() => {
    setDeleteMode((current) => !current)
    setDeleteSelection(new Set())
  }, [])

  const handleDeleteSelected = useCallback(async () => {
    const selectedIds = [...deleteSelection]
    if (!canDeleteImprints || selectedIds.length === 0 || deleteRequestPending) return

    setDeleteRequestPending(true)
    try {
      const requestedIds = new Set(selectedIds)
      const deletedIds = new Set(
        (await onDeleteImprints(selectedIds)).filter((id) => requestedIds.has(id)),
      )
      if (deletedIds.size > 0) {
        setDeleteSelection(new Set())
        setDeleteMode(false)
      }
    } finally {
      setDeleteRequestPending(false)
    }
  }, [canDeleteImprints, deleteRequestPending, deleteSelection, onDeleteImprints])

  useEffect(() => {
    if (reducedMotion) {
      backdropCurrentUrlRef.current = selectedPreviewUrl
      setBackdropLayers({ previous: null, current: selectedPreviewUrl })
      return
    }

    const previousUrl = backdropCurrentUrlRef.current
    if (previousUrl === selectedPreviewUrl) return
    backdropCurrentUrlRef.current = selectedPreviewUrl
    setBackdropLayers({ previous: previousUrl, current: selectedPreviewUrl })
    const timer = window.setTimeout(() => {
      setBackdropLayers((current) =>
        current.current === selectedPreviewUrl ? { ...current, previous: null } : current,
      )
    }, BACKDROP_TRANSITION_DURATION)
    return () => window.clearTimeout(timer)
  }, [reducedMotion, selectedPreviewUrl])

  return (
    <section className="lineage-graph-panel" aria-label="Archive lineage graph">
      <div className="lineage-graph-backdrop" aria-hidden="true">
        {backdropLayers.previous !== null && (
          <div
            key={`outgoing:${backdropLayers.previous}`}
            className="lineage-graph-backdrop-poster lineage-graph-backdrop-poster-outgoing"
            style={{ backgroundImage: `url("${backdropLayers.previous}")` }}
          />
        )}
        {backdropLayers.current !== null && (
          <div
            key={`incoming:${backdropLayers.current}`}
            className="lineage-graph-backdrop-poster lineage-graph-backdrop-poster-incoming"
            style={{ backgroundImage: `url("${backdropLayers.current}")` }}
          />
        )}
        <div className="lineage-graph-backdrop-overlay" />
      </div>
      <div className="lineage-graph-toolbar" role="group" aria-label="Graph controls">
        <div className="lineage-graph-buttons">
          <button
            type="button"
            className={`button--quiet lineage-graph-delete-action${
              deleteMode ? '' : ' lineage-graph-delete-action-hidden'
            }`}
            aria-hidden={!deleteMode}
            aria-label={
              deleteMode
                ? `Delete ${deleteSelection.size} selected Imprint${deleteSelection.size === 1 ? '' : 's'}`
                : 'Delete mode selection count'
            }
            aria-busy={deleteRequestPending}
            disabled={
              !deleteMode ||
              deleteSelection.size === 0 ||
              !canDeleteImprints ||
              deleteRequestPending
            }
            onClick={() => {
              void handleDeleteSelected().catch((error: unknown) => {
                reportApplicationError(
                  `Could not delete the selected Imprints: ${error instanceof Error ? error.message : String(error)}`,
                )
              })
            }}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 7h16M9 7V4h6v3m-9 0 1 13h10l1-13M10 11v5m4-5v5" />
            </svg>
            <span aria-live="polite">{deleteSelection.size}x</span>
          </button>
          <button
            type="button"
            className={`lineage-graph-delete-switch${deleteMode ? ' lineage-graph-delete-switch-active' : ''}`}
            role="switch"
            aria-label="Delete"
            aria-checked={deleteMode}
            onClick={handleToggleDeleteMode}
          >
            <span className="lineage-graph-delete-switch-track" aria-hidden="true">
              <span className="lineage-graph-delete-switch-thumb" />
            </span>
            <span>Delete</span>
          </button>
          <button
            type="button"
            className="button--quiet"
            aria-label="Zoom out"
            onClick={() => zoomAtCenter(1 / 1.2)}
          >
            −
          </button>
          <button
            type="button"
            className="button--quiet"
            aria-label="Zoom in"
            onClick={() => zoomAtCenter(1.2)}
          >
            +
          </button>
          <button type="button" className="button--quiet" onClick={handleResetLayout}>
            Reset layout
          </button>
        </div>
      </div>
      <div className="lineage-graph-viewport">
        <svg
          ref={svgRef}
          className="lineage-graph"
          role="group"
          aria-label={
            deleteMode
              ? 'Lineage graph delete mode; select inactive Imprints to delete, and use arrow keys to move nodes'
              : 'Lineage graph; Tab to focus a node, Enter or Space to select and activate it in Presence, and arrow keys to move it'
          }
          viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
          width="100%"
          height="100%"
          onPointerDown={onBackgroundPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={(event) => finishGesture(event, false)}
          onPointerCancel={(event) => finishGesture(event, true)}
        >
          <defs>
            <marker
              id="lineage-parent-arrow"
              markerWidth="2"
              markerHeight="2"
              refX="1.75"
              refY="1"
              orient="auto"
            >
              <path d="M0 0 L2 1 L0 2 Z" className="lineage-arrow-parent" />
            </marker>
          </defs>
          <g transform={`translate(${viewport.x} ${viewport.y}) scale(${viewport.scale})`}>
            <rect
              className="lineage-graph-background"
              width={dimensions.width}
              height={dimensions.height}
              aria-hidden="true"
            />
            <g ref={graphGroupRef}>
              {graph.edges.map((edge) => {
                const from = positions.get(edge.from) ?? initialPositions.get(edge.from)
                const to = positions.get(edge.to) ?? initialPositions.get(edge.to)
                if (from === undefined || to === undefined) return null
                const dx = to.x - from.x
                const dy = to.y - from.y
                const distance = Math.max(1, Math.hypot(dx, dy))
                const fromNode = nodesByKey.get(edge.from)
                const toNode = nodesByKey.get(edge.to)
                const directionX = dx / distance
                const directionY = dy / distance
                const fromOffset = fromNode?.role === 'seed' ? 56 : 43
                const toOffset = toNode?.role === 'seed' ? 56 : 43
                return (
                  <line
                    key={`${edge.from}:${edge.to}`}
                    className="lineage-graph-edge"
                    x1={from.x + directionX * fromOffset}
                    y1={from.y + directionY * fromOffset}
                    x2={to.x - directionX * toOffset}
                    y2={to.y - directionY * toOffset}
                    markerEnd="url(#lineage-parent-arrow)"
                    role="img"
                    aria-label={`Parent: ${fromNode?.id ?? edge.from} to ${toNode?.id ?? edge.to}`}
                  />
                )
              })}
              {graph.nodes.map((node) => (
                <GraphNode
                  key={node.key}
                  node={node}
                  position={positionFor(node)}
                  active={isActive(node, presence)}
                  selected={deleteMode ? deleteSelection.has(node.id) : isSelected(selection, node)}
                  deleteMode={deleteMode}
                  deletable={canDeleteLineageNode(node, presence)}
                  animationActive={activeAnimationKey === node.key}
                  reducedMotion={reducedMotion}
                  onSelect={handleNodeSelect}
                  onSelectedPreviewChange={setSelectedPreviewUrl}
                  onPointerDown={onNodePointerDown}
                  onAnimationStart={startAnimation}
                  onAnimationStop={stopAnimation}
                  onMoveBy={onNodeMoveBy}
                />
              ))}
            </g>
          </g>
        </svg>
      </div>
    </section>
  )
}

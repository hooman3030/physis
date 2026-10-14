import { useMemo } from 'react'
import { type CodeNodeRecord, type ImprintRecord, type PresenceSnapshot } from '../../controlClient'
import { createLineageGraph } from './lineageGraph'
import { LineageGraphView } from './LineageGraphView'

export type LineageSelection = {
  kind: 'code' | 'imprint'
  id: string
}

export function getInitialLineageSelection(
  presence: PresenceSnapshot | null,
  imprints: readonly ImprintRecord[],
): LineageSelection | null {
  const imprintId = presence?.imprint?.id
  return imprintId !== undefined && imprints.some((imprint) => imprint.id === imprintId)
    ? { kind: 'imprint', id: imprintId }
    : null
}

export function shouldActivateLineageSelection(
  selection: LineageSelection,
  presence: PresenceSnapshot | null,
  codeNodes: readonly CodeNodeRecord[],
  imprints: readonly ImprintRecord[],
  controlStatus: 'connecting' | 'connected' | 'offline',
): boolean {
  if (controlStatus !== 'connected') return false

  if (selection.kind === 'code') {
    const codeNode = codeNodes.find((node) => node.id === selection.id)
    return (
      codeNode?.available === true &&
      !(presence?.code?.id === selection.id && presence.imprint === null)
    )
  }

  const imprint = imprints.find((node) => node.id === selection.id)
  return (
    imprint !== undefined &&
    codeNodes.some((node) => node.id === imprint.codeId && node.available) &&
    presence?.imprint?.id !== selection.id
  )
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
  const graph = useMemo(() => createLineageGraph(codeNodes, imprints), [codeNodes, imprints])
  const statusMessage = authenticationRequired
    ? 'Pair this browser to access the archive.'
    : loading
      ? 'Loading the archive…'
      : loadFailed
        ? 'The archive could not be loaded.'
        : controlStatus === 'connected'
          ? null
          : 'The local control API is unavailable.'
  const handleSelect = (nextSelection: LineageSelection) => {
    onSelect(nextSelection)
    if (
      shouldActivateLineageSelection(nextSelection, presence, codeNodes, imprints, controlStatus)
    ) {
      onActivate(nextSelection)
    }
  }

  return (
    <>
      <header className="lineage-header">
        <a className="lineage-back-link" href="/">
          Back to artwork
        </a>
        <h1>Lineage Explorer</h1>
      </header>
      {statusMessage !== null && (
        <p className="lineage-status" role="status">
          {statusMessage}
        </p>
      )}
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
              <LineageGraphView
                graph={graph}
                presence={presence}
                selection={selection}
                onSelect={handleSelect}
              />
            </div>
          )}
        </>
      )}
    </>
  )
}

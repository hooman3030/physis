import type { ImprintRecord } from './controlClient'

type ImprintArchiveProps = {
  imprints: readonly ImprintRecord[]
  activeImprintId: string | null
  connected: boolean
  loading: boolean
  error: string | null
  onRefresh: () => void
  onSelect: (imprint: ImprintRecord) => void
  hidden?: boolean
}

function formatCreatedAt(value: string): string {
  const timestamp = new Date(value)
  return Number.isNaN(timestamp.getTime()) ? value : timestamp.toLocaleString()
}

export function ImprintArchive({
  imprints,
  activeImprintId,
  connected,
  loading,
  error,
  onRefresh,
  onSelect,
  hidden = false,
}: ImprintArchiveProps) {
  return (
    <section
      id="imprint-archive"
      className="studio-panel archive-panel"
      aria-label="Imprint archive"
      hidden={hidden}
    >
      <div className="archive-heading">
        <div>
          <p className="eyebrow">Archive</p>
          <h2>Imprints</h2>
        </div>
        <button type="button" onClick={onRefresh} disabled={!connected || loading}>
          Refresh
        </button>
      </div>
      <p className="control-status" role="status">
        {connected
          ? `${imprints.length} saved ${imprints.length === 1 ? 'Imprint' : 'Imprints'}`
          : 'Connect to the local control API to browse Imprints.'}
      </p>
      {loading && (
        <p className="control-status" role="status">
          Loading archive…
        </p>
      )}
      {error !== null && (
        <p className="control-error" role="alert">
          {error}
        </p>
      )}
      {!loading && error === null && connected && imprints.length === 0 && (
        <p className="archive-empty">No Imprints saved yet.</p>
      )}
      {imprints.length > 0 && (
        <ul className="imprint-list">
          {imprints.map((imprint) => {
            const active = imprint.id === activeImprintId
            const parameters = Object.entries(imprint.parameters)
              .map(([id, value]) => `${id}: ${value}`)
              .join(' · ')

            return (
              <li key={imprint.id}>
                <button
                  type="button"
                  className="imprint-entry"
                  aria-pressed={active}
                  title={imprint.id}
                  disabled={!connected}
                  onClick={() => onSelect(imprint)}
                >
                  <span className="imprint-entry-heading">
                    <code>{imprint.id.slice(0, 8)}</code>
                    {active && <span className="imprint-active">Active</span>}
                  </span>
                  <span className="imprint-metadata">
                    {imprint.codeId} · {formatCreatedAt(imprint.createdAt)}
                  </span>
                  <span className="imprint-metadata">
                    {imprint.parentId === null
                      ? 'Root Imprint'
                      : `Parent ${imprint.parentId.slice(0, 8)}`}
                    {' · '}revision {imprint.sourceRevision.slice(0, 7)}
                  </span>
                  {parameters !== '' && <span className="imprint-parameters">{parameters}</span>}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

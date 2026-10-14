import type { ImprintRecord } from './controlClient'

type ImprintArchiveProps = {
  imprints: readonly ImprintRecord[]
  activeImprintId: string | null
  connected: boolean
  loading: boolean
  loadFailed: boolean
  onSelect: (imprint: ImprintRecord) => void
  onDelete: (imprint: ImprintRecord) => void
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
  loadFailed,
  onSelect,
  onDelete,
  hidden = false,
}: ImprintArchiveProps) {
  return (
    <section
      id="imprint-archive"
      className="studio-panel archive-panel surface shape-panel"
      aria-label="Imprint archive"
      hidden={hidden}
    >
      <div className="archive-heading">
        <div>
          <p className="eyebrow">Archive</p>
          <h2>Imprints</h2>
        </div>
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
      {!loading && !loadFailed && connected && imprints.length === 0 && (
        <p className="archive-empty">No Imprints saved yet.</p>
      )}
      {imprints.length > 0 && (
        <ul className="imprint-list">
          {imprints.map((imprint) => {
            const active = imprint.id === activeImprintId

            return (
              <li
                key={imprint.id}
                className={`imprint-entry surface shape-card${active ? ' imprint-entry-active' : ''}`}
              >
                <button
                  type="button"
                  className="imprint-select"
                  aria-pressed={active}
                  disabled={!connected}
                  onClick={() => onSelect(imprint)}
                >
                  <span className="imprint-entry-heading">
                    <span>{imprint.codeId}</span>
                  </span>
                  <time className="imprint-metadata" dateTime={imprint.createdAt}>
                    {formatCreatedAt(imprint.createdAt)}
                  </time>
                </button>
                <button
                  type="button"
                  className="imprint-delete"
                  aria-label={`Delete Imprint from ${formatCreatedAt(imprint.createdAt)}`}
                  title={
                    active ? 'Select another Imprint before deleting this one' : 'Delete Imprint'
                  }
                  disabled={!connected || active}
                  onClick={() => onDelete(imprint)}
                >
                  <span aria-hidden="true">×</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

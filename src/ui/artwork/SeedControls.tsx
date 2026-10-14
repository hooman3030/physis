import type { P5Seed } from '../../seeds/p5/types'
import type { ArtworkGeneValues } from '../../seeds/types'

type SeedControlsProps = {
  activeSeed: P5Seed
  seeds: readonly P5Seed[]
  onSeedChange: (seed: P5Seed) => void
  geneValues: ArtworkGeneValues
  onGeneChange: (id: string, value: number) => void
  onSaveImprint: () => void
  controlStatus: 'connecting' | 'connected' | 'offline'
  saveStatus: 'idle' | 'saving' | 'saved'
  controlsDisabled?: boolean
  hidden?: boolean
}

export function SeedControls({
  activeSeed,
  seeds,
  onSeedChange,
  geneValues,
  onGeneChange,
  onSaveImprint,
  controlStatus,
  saveStatus,
  controlsDisabled = false,
  hidden = false,
}: SeedControlsProps) {
  const connectionLabel = {
    connected: 'API',
    connecting: 'Connecting',
    offline: 'Offline',
  }[controlStatus]

  return (
    <section
      id="artwork-controls"
      className="studio-panel surface shape-panel"
      aria-label="Artwork controls"
      hidden={hidden}
    >
      <div className="controls-heading">
        <div className="controls-header">
          <p className="eyebrow">controls</p>
        </div>
        <h2>Seeds</h2>
      </div>
      <span
        className="connection-indicator"
        data-status={controlStatus}
        role="status"
        aria-label={
          controlStatus === 'connected'
            ? 'Connected to installation'
            : controlStatus === 'connecting'
              ? 'Connecting to installation'
              : 'Installation control API unavailable'
        }
        title={
          controlStatus === 'connected'
            ? 'Connected to installation'
            : controlStatus === 'connecting'
              ? 'Connecting to installation'
              : 'Installation control API unavailable'
        }
      >
        <span className="connection-indicator-dot" aria-hidden="true" />
        <span className="connection-indicator-label" aria-hidden="true">
          {connectionLabel}
        </span>
      </span>
      <label htmlFor="seed">Choose a seed module</label>
      <select
        id="seed"
        value={activeSeed.id}
        disabled={controlsDisabled}
        onChange={(event) => {
          const nextSeed = seeds.find((candidate) => candidate.id === event.target.value)
          if (nextSeed) onSeedChange(nextSeed)
        }}
      >
        {seeds.map((candidate) => (
          <option key={candidate.id} value={candidate.id}>
            {candidate.label}
          </option>
        ))}
      </select>
      <h3>Genes</h3>
      {activeSeed.genes.map((gene) => {
        const value = geneValues[gene.id] ?? gene.defaultValue
        const inputId = `gene-${gene.id}`
        const progress = Math.min(
          100,
          Math.max(0, ((value - gene.min) / (gene.max - gene.min)) * 100),
        )

        return (
          <div className="gene-control" key={gene.id}>
            <div className="gene-heading">
              <label htmlFor={inputId}>{gene.label}</label>
              <output htmlFor={inputId}>{Number(value.toFixed(4))}</output>
            </div>
            <input
              id={inputId}
              className="range-control"
              type="range"
              min={gene.min}
              max={gene.max}
              step={gene.step}
              value={value}
              style={{
                background: `linear-gradient(90deg, var(--color-accent) ${progress}%, var(--track-background) ${progress}%) center / 100% var(--range-track-height) no-repeat`,
              }}
              disabled={controlsDisabled}
              onChange={(event) => onGeneChange(gene.id, Number(event.target.value))}
            />
          </div>
        )
      })}
      <button
        type="button"
        className="save-imprint"
        disabled={controlsDisabled || controlStatus !== 'connected' || saveStatus === 'saving'}
        onClick={onSaveImprint}
      >
        <span className={`save-feedback save-feedback-${saveStatus}`} aria-live="polite">
          {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'saved' ? 'Saved' : 'Save Imprint'}
        </span>
      </button>
    </section>
  )
}

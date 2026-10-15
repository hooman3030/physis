import type { P5Seed } from '../../seeds/p5/types'
import type { ArtworkGene, ArtworkGeneValues } from '../../seeds/types'

export function getDefaultGeneValues(genes: readonly ArtworkGene[]): ArtworkGeneValues {
  return Object.fromEntries(genes.map(({ id, defaultValue }) => [id, defaultValue]))
}

export function randomizeGeneValues(
  genes: readonly ArtworkGene[],
  random: () => number = Math.random,
): ArtworkGeneValues {
  return Object.fromEntries(
    genes.map(({ id, min, max, step }) => {
      const stepCount = Math.floor((max - min) / step)
      const value = min + Math.floor(random() * (stepCount + 1)) * step
      const precision = Math.max(
        min.toString().split('.')[1]?.length ?? 0,
        max.toString().split('.')[1]?.length ?? 0,
        step.toString().split('.')[1]?.length ?? 0,
      )
      return [id, Number(value.toFixed(precision))]
    }),
  )
}

type SeedControlsProps = {
  activeSeed: P5Seed
  seeds: readonly P5Seed[]
  onSeedChange: (seed: P5Seed) => void
  geneValues: ArtworkGeneValues
  onGeneChange: (id: string, value: number) => void
  onGenesChange: (values: ArtworkGeneValues) => void
  onResetCanvas: () => void
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
  onGenesChange,
  onResetCanvas,
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
        className="control"
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
      <div className="genes-heading">
        <h3>Genes</h3>
        <div className="gene-actions">
          <button
            type="button"
            className="button--quiet"
            title="rebirth (r)"
            aria-label="rebirth, R key"
            onClick={onResetCanvas}
          >
            rebirth <kbd className="gene-action-key">r</kbd>
          </button>
          <button
            type="button"
            className="button--quiet"
            title="Reset genes to defaults"
            aria-label="Reset genes to defaults"
            disabled={controlsDisabled}
            onClick={() => onGenesChange(getDefaultGeneValues(activeSeed.genes))}
          >
            reset
          </button>
          <button
            type="button"
            className="button--quiet"
            title="Randomize all genes"
            aria-label="Randomize all genes"
            disabled={controlsDisabled}
            onClick={() => onGenesChange(randomizeGeneValues(activeSeed.genes))}
          >
            <svg
              className="gene-action-icon"
              viewBox="0 0 24 24"
              aria-hidden="true"
              focusable="false"
            >
              <rect
                x="3.5"
                y="3.5"
                width="17"
                height="17"
                rx="3"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              />
              <circle cx="8" cy="8" r="1.3" fill="currentColor" />
              <circle cx="12" cy="12" r="1.3" fill="currentColor" />
              <circle cx="16" cy="16" r="1.3" fill="currentColor" />
              <circle cx="16" cy="8" r="1.3" fill="currentColor" />
              <circle cx="8" cy="16" r="1.3" fill="currentColor" />
            </svg>
          </button>
        </div>
      </div>
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
        className="button--primary save-imprint"
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

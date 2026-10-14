import type { P5Seed } from '../../seeds/p5/types'
import type { ArtworkParameterValues } from '../../seeds/types'

type SeedControlsProps = {
  activeSeed: P5Seed
  seeds: readonly P5Seed[]
  onSeedChange: (seed: P5Seed) => void
  parameterValues: ArtworkParameterValues
  onParameterChange: (id: string, value: number) => void
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
  parameterValues,
  onParameterChange,
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
      {activeSeed.parameters.map((parameter) => {
        const value = parameterValues[parameter.id] ?? parameter.defaultValue
        const inputId = `parameter-${parameter.id}`
        const progress = Math.min(
          100,
          Math.max(0, ((value - parameter.min) / (parameter.max - parameter.min)) * 100),
        )

        return (
          <div className="parameter-control" key={parameter.id}>
            <div className="parameter-heading">
              <label htmlFor={inputId}>{parameter.label}</label>
              <output htmlFor={inputId}>{Number(value.toFixed(4))}</output>
            </div>
            <input
              id={inputId}
              className="range-control"
              type="range"
              min={parameter.min}
              max={parameter.max}
              step={parameter.step}
              value={value}
              style={{
                background: `linear-gradient(90deg, var(--color-accent) ${progress}%, var(--track-background) ${progress}%) center / 100% var(--range-track-height) no-repeat`,
              }}
              disabled={controlsDisabled}
              onChange={(event) => onParameterChange(parameter.id, Number(event.target.value))}
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

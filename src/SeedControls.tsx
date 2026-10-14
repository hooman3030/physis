import type { ArtworkParameterValues, ArtworkSeed } from './seeds/types'

type SeedControlsProps = {
  activeSeed: ArtworkSeed
  seeds: readonly ArtworkSeed[]
  onSeedChange: (seed: ArtworkSeed) => void
  parameterValues: ArtworkParameterValues
  onParameterChange: (id: string, value: number) => void
  onSaveImprint: () => void
  controlStatus: 'connecting' | 'connected' | 'offline'
  controlError: string | null
  operationMessage: string | null
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
  controlError,
  operationMessage,
  controlsDisabled = false,
  hidden = false,
}: SeedControlsProps) {
  return (
    <section
      id="artwork-controls"
      className="studio-panel"
      aria-label="Artwork controls"
      hidden={hidden}
    >
      <p className="eyebrow">physis ⍩‣➣"(⌯_ .∙✧ ✵・• ∙. ∙・⏜ ◎ ⏝◦ ○ ∙ </p>
      <p className="control-status" role="status">
        {controlStatus === 'connected'
          ? 'Connected to local control API'
          : controlStatus === 'connecting'
            ? 'Connecting to local control API…'
            : 'Local control API unavailable; browser-only controls are active.'}
      </p>
      {controlError !== null && (
        <p className="control-error" role="alert">
          {controlError}
        </p>
      )}
      {operationMessage !== null && (
        <p className="control-status" role="status">
          {operationMessage}
        </p>
      )}
      <p className="seed-label">
        Active module: <code>{activeSeed.id}</code>
      </p>
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

        return (
          <div className="parameter-control" key={parameter.id}>
            <div className="parameter-heading">
              <label htmlFor={inputId}>{parameter.label}</label>
              <output htmlFor={inputId}>{Number(value.toFixed(4))}</output>
            </div>
            <input
              id={inputId}
              type="range"
              min={parameter.min}
              max={parameter.max}
              step={parameter.step}
              value={value}
              disabled={controlsDisabled}
              onChange={(event) => onParameterChange(parameter.id, Number(event.target.value))}
            />
          </div>
        )
      })}
      <button
        type="button"
        className="save-imprint"
        disabled={controlsDisabled || controlStatus !== 'connected'}
        onClick={onSaveImprint}
      >
        Save Imprint
      </button>
    </section>
  )
}

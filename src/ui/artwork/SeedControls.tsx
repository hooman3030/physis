import { useState } from 'react'
import { isBipolarGene, type ArtworkGene, type ArtworkGeneValues } from '../../seeds/types'
import type { ArtworkSeed } from '../../seeds/registry'
import type { AuraId } from '../../auras/types'
import { auraPresets, isAuraId } from '../../auras/registry'
import type { ToneMappingId } from '../../auras/toneMapping'
import { isToneMappingId, toneMappingOptions } from '../../auras/toneMapping'
import { reportApplicationError } from '../../errorNotifications'
import { PrimaryButton } from '../primitives/PrimaryButton'
import { useSurfaceTransition } from '../primitives/useSurfaceTransition'

const diePipPositions: Readonly<Record<number, readonly (readonly [number, number])[]>> = {
  1: [[12, 12]],
  2: [
    [8, 8],
    [16, 16],
  ],
  3: [
    [8, 8],
    [12, 12],
    [16, 16],
  ],
  4: [
    [8, 8],
    [16, 8],
    [8, 16],
    [16, 16],
  ],
  5: [
    [8, 8],
    [16, 8],
    [12, 12],
    [8, 16],
    [16, 16],
  ],
  6: [
    [8, 8],
    [16, 8],
    [8, 12],
    [16, 12],
    [8, 16],
    [16, 16],
  ],
}

export function rollDie(random: () => number = Math.random): number {
  return Math.floor(random() * 6) + 1
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
  activeSeed: ArtworkSeed
  seeds: readonly ArtworkSeed[]
  onSeedChange: (seed: ArtworkSeed) => void
  auraId: AuraId | null
  onAuraChange: (auraId: AuraId) => void
  toneMappingId: ToneMappingId | null
  onToneMappingChange: (toneMappingId: ToneMappingId) => void
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
  auraId,
  onAuraChange,
  toneMappingId,
  onToneMappingChange,
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
  const [diceRoll, setDiceRoll] = useState(0)
  const [diceFace, setDiceFace] = useState(5)
  const [isRolling, setIsRolling] = useState(false)
  const surfaceTransition = useSurfaceTransition(!hidden)
  const connectionLabel = {
    connected: 'API',
    connecting: 'Connecting',
    offline: 'Offline',
  }[controlStatus]

  return (
    <section
      id="artwork-controls"
      className={`studio-panel surface shape-panel ${surfaceTransition.className}`}
      aria-label="Artwork controls"
      aria-hidden={surfaceTransition.ariaHidden}
      hidden={surfaceTransition.hidden}
      inert={surfaceTransition.inert}
      onAnimationEnd={surfaceTransition.onAnimationEnd}
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
      {activeSeed.runtime === 'three' && (
        <div className="presentation-selectors">
          <div className="presentation-selector">
            <label htmlFor="aura">Aura</label>
            <select
              id="aura"
              className="control"
              value={auraId ?? 'off'}
              onChange={(event) => {
                const value = event.currentTarget.value
                if (isAuraId(value)) {
                  onAuraChange(value)
                } else {
                  reportApplicationError(`Unknown Aura selection: ${value}`)
                }
              }}
            >
              {auraPresets.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.label}
                </option>
              ))}
            </select>
          </div>
          <div className="presentation-selector">
            <label htmlFor="tone-mapping">Tone mapping</label>
            <select
              id="tone-mapping"
              className="control"
              value={toneMappingId ?? 'none'}
              onChange={(event) => {
                const value = event.currentTarget.value
                if (isToneMappingId(value)) {
                  onToneMappingChange(value)
                } else {
                  reportApplicationError(`Unknown tone mapping selection: ${value}`)
                }
              }}
            >
              {toneMappingOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
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
            className="button--quiet gene-randomize-button"
            title="Randomize all genes"
            aria-label="Randomize all genes"
            disabled={controlsDisabled}
            onClick={() => {
              setDiceRoll((roll) => roll + 1)
              setDiceFace(rollDie())
              if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
                setIsRolling(true)
              }
              onGenesChange(randomizeGeneValues(activeSeed.genes))
            }}
          >
            <svg
              key={diceRoll}
              className={`gene-action-icon${isRolling ? ' gene-action-icon--rolling' : ''}`}
              viewBox="0 0 24 24"
              aria-hidden="true"
              focusable="false"
              onAnimationEnd={() => setIsRolling(false)}
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
              {diePipPositions[diceFace].map(([cx, cy]) => (
                <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.3" fill="currentColor" />
              ))}
            </svg>
          </button>
          <PrimaryButton
            type="button"
            className={`button--compact save-imprint save-imprint--${saveStatus}`}
            animateOnClick={false}
            aria-label="Save Imprint"
            title="Save Imprint"
            aria-busy={saveStatus === 'saving'}
            disabled={controlsDisabled || controlStatus !== 'connected' || saveStatus === 'saving'}
            onClick={onSaveImprint}
          >
            <span className={`save-feedback save-feedback-${saveStatus}`} aria-live="polite">
              <svg className="save-imprint-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 4.75A1.75 1.75 0 0 1 7.75 3h8.5A1.75 1.75 0 0 1 18 4.75V21l-6-3.5L6 21z" />
              </svg>
              <span aria-hidden={saveStatus === 'saved'}>
                {saveStatus === 'saving' ? '…' : 'Save'}
              </span>
              {saveStatus === 'saved' && <span className="visually-hidden">Imprint saved</span>}
            </span>
          </PrimaryButton>
        </div>
      </div>
      {activeSeed.genes.map((gene) => {
        const value = geneValues[gene.id] ?? gene.defaultValue
        const inputId = `gene-${gene.id}`
        const progress = Math.min(
          100,
          Math.max(0, ((value - gene.min) / (gene.max - gene.min)) * 100),
        )

        const fill = isBipolarGene(gene)
          ? `var(--track-background) ${Math.min(progress, 50)}%, var(--color-accent) ${Math.min(progress, 50)}%, var(--color-accent) ${Math.max(progress, 50)}%, var(--track-background) ${Math.max(progress, 50)}%`
          : `var(--color-accent) ${progress}%, var(--track-background) ${progress}%`

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
                background: `linear-gradient(90deg, ${fill}) center / 100% var(--range-track-height) no-repeat`,
              }}
              disabled={controlsDisabled}
              onChange={(event) => onGeneChange(gene.id, Number(event.target.value))}
            />
          </div>
        )
      })}
    </section>
  )
}

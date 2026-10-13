import type { ArtworkSeed } from './seeds/types'

type SeedControlsProps = {
  activeSeed: ArtworkSeed
  seeds: readonly ArtworkSeed[]
  onSeedChange: (seed: ArtworkSeed) => void
  hidden?: boolean
}

export function SeedControls({
  activeSeed,
  seeds,
  onSeedChange,
  hidden = false,
}: SeedControlsProps) {
  return (
    <section
      id="artwork-controls"
      className="studio-panel"
      aria-label="Artwork controls"
      hidden={hidden}
    >
      <p className="eyebrow">PHYSIS / CONTROLS</p>
      <h2>Artwork controls</h2>
      <p className="seed-label">
        Active module: <code>{activeSeed.id}</code> — {activeSeed.label}
      </p>
      <label htmlFor="seed">Choose a seed module</label>
      <select
        id="seed"
        value={activeSeed.id}
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
    </section>
  )
}

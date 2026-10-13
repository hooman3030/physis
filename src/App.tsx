import { useState } from 'react'
import { ArtworkCanvas } from './ArtworkCanvas'
import { artworkSeeds, defaultArtworkSeed } from './seeds/registry'
import type { ArtworkSeed } from './seeds/types'
import './styles.css'

export function App() {
  const [seed, setSeed] = useState<ArtworkSeed>(defaultArtworkSeed)

  return (
    <main>
      <ArtworkCanvas key={seed.id} seed={seed} />
      <section className="studio-panel" aria-label="Artwork controls">
        <p className="eyebrow">PHYSIS / FIRST SLICE</p>
        <h1>Living matter, rendered.</h1>
        <p className="seed-label">Current seed: {seed.label}</p>
        <label htmlFor="seed">Choose a seed module</label>
        <select
          id="seed"
          value={seed.id}
          onChange={(event) => {
            const nextSeed = artworkSeeds.find((candidate) => candidate.id === event.target.value)
            if (nextSeed) setSeed(nextSeed)
          }}
        >
          {artworkSeeds.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>
              {candidate.label}
            </option>
          ))}
        </select>
      </section>
    </main>
  )
}

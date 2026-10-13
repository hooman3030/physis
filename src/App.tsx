import { useState } from 'react'
import { ArtworkCanvas } from './ArtworkCanvas'
import './styles.css'

const initialSeed = 'first-light'

export function App() {
  const [seed, setSeed] = useState(initialSeed)
  const [draftSeed, setDraftSeed] = useState(initialSeed)

  function applySeed(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextSeed = draftSeed.trim()
    if (nextSeed) setSeed(nextSeed)
  }

  return (
    <main>
      <ArtworkCanvas key={seed} seed={seed} />
      <section className="studio-panel" aria-label="Artwork controls">
        <p className="eyebrow">PHYSIS / FIRST SLICE</p>
        <h1>Living matter, rendered.</h1>
        <p className="seed-label">Current seed: {seed}</p>
        <form onSubmit={applySeed}>
          <label htmlFor="seed">Explore another seed</label>
          <div className="seed-controls">
            <input
              id="seed"
              value={draftSeed}
              onChange={(event) => setDraftSeed(event.target.value)}
            />
            <button type="submit">Render</button>
          </div>
        </form>
      </section>
    </main>
  )
}

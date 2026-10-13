import { useEffect, useState } from 'react'
import { ArtworkCanvas } from './ArtworkCanvas'
import { loadSettings, saveSettings, type ArtworkSettings } from './persistence'
import { SeedControls } from './SeedControls'
import { artworkSeeds, defaultArtworkSeed } from './seeds/registry'
import type { ArtworkSeed } from './seeds/types'
import './styles.css'

export function App() {
  const [settings, setSettings] = useState<ArtworkSettings>(() =>
    loadSettings(artworkSeeds, defaultArtworkSeed),
  )
  const [controlsOpen, setControlsOpen] = useState(false)
  const { seed } = settings
  const parameterValues = settings.parametersBySeed[seed.id]

  useEffect(() => {
    saveSettings(settings)
  }, [settings])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setControlsOpen(false)
        return
      }

      const target = event.target
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable || target.matches('input, select, textarea'))
      ) {
        return
      }

      if (
        event.code === 'KeyD' &&
        !event.altKey &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.repeat
      ) {
        event.preventDefault()
        setControlsOpen((open) => !open)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleSeedChange = (nextSeed: ArtworkSeed) => {
    setSettings((current) => ({ ...current, seed: nextSeed }))
  }

  return (
    <main>
      <ArtworkCanvas key={seed.id} seed={seed} parameters={parameterValues} />
      <button
        type="button"
        className="controls-reveal"
        aria-label={controlsOpen ? 'Hide artwork controls' : 'Show artwork controls'}
        aria-controls="artwork-controls"
        aria-expanded={controlsOpen}
        title="Artwork controls (D)"
        onClick={() => setControlsOpen((open) => !open)}
      >
        <span className="controls-reveal-mark" aria-hidden="true" />
      </button>
      <SeedControls
        activeSeed={seed}
        seeds={artworkSeeds}
        onSeedChange={handleSeedChange}
        parameterValues={parameterValues}
        onParameterChange={(id, value) => {
          setSettings((current) => ({
            ...current,
            parametersBySeed: {
              ...current.parametersBySeed,
              [current.seed.id]: { ...current.parametersBySeed[current.seed.id], [id]: value },
            },
          }))
        }}
        hidden={!controlsOpen}
      />
    </main>
  )
}

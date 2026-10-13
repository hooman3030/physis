import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { SeedControls } from './SeedControls'
import { artworkSeeds, defaultArtworkSeed } from './seeds/registry'

describe('seed controls', () => {
  it('shows the active module identity and registered alternatives', () => {
    const markup = renderToStaticMarkup(
      <SeedControls activeSeed={defaultArtworkSeed} seeds={artworkSeeds} onSeedChange={vi.fn()} />,
    )

    expect(markup).toContain(defaultArtworkSeed.id)
    expect(markup).toContain(defaultArtworkSeed.label)
    expect(markup).toContain('drifting-filaments')
  })
})

import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { SeedControls } from './SeedControls'
import { driftingFilamentsSeed } from './seeds/driftingFilaments'
import { artworkSeeds, defaultArtworkSeed } from './seeds/registry'

describe('seed controls', () => {
  it('shows the active module identity and registered alternatives', () => {
    const markup = renderToStaticMarkup(
      <SeedControls
        activeSeed={defaultArtworkSeed}
        seeds={artworkSeeds}
        onSeedChange={vi.fn()}
        parameterValues={{}}
        onParameterChange={vi.fn()}
      />,
    )

    expect(markup).toContain(defaultArtworkSeed.id)
    expect(markup).toContain(defaultArtworkSeed.label)
    expect(markup).toContain('drifting-filaments')
  })

  it('renders parameter sliders for the active module', () => {
    const markup = renderToStaticMarkup(
      <SeedControls
        activeSeed={driftingFilamentsSeed}
        seeds={artworkSeeds}
        onSeedChange={vi.fn()}
        parameterValues={{ filamentCount: 200, noiseScale: 0.002, stepLength: 2 }}
        onParameterChange={vi.fn()}
      />,
    )

    expect(markup).toContain('Filament count')
    expect(markup).toContain('value="200"')
    expect(markup).toContain('Noise scale')
    expect(markup).toContain('Step length')
  })
})

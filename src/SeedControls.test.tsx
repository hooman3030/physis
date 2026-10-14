import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { SeedControls } from './SeedControls'
import { driftingFilamentsSeed } from './seeds/driftingFilaments'
import { artworkSeeds, defaultArtworkSeed } from './seeds/registry'

describe('seed controls', () => {
  it('shows the module selector and registered alternatives without duplicate active-module info', () => {
    const markup = renderToStaticMarkup(
      <SeedControls
        activeSeed={defaultArtworkSeed}
        seeds={artworkSeeds}
        onSeedChange={vi.fn()}
        parameterValues={{}}
        onParameterChange={vi.fn()}
        onSaveImprint={vi.fn()}
        controlStatus="offline"
        saveStatus="idle"
      />,
    )

    expect(markup).toContain(defaultArtworkSeed.label)
    expect(markup).toContain('aria-label="Installation control API unavailable"')
    expect(markup).toContain('class="connection-indicator"')
    expect(markup).toContain('class="connection-indicator-label" aria-hidden="true">Offline')
    expect(markup).not.toContain('Active module:')
    expect(markup).not.toContain('browser-only controls are active')
    expect(markup).toContain('disabled=""')
  })

  it('renders parameter sliders for the active module', () => {
    const markup = renderToStaticMarkup(
      <SeedControls
        activeSeed={driftingFilamentsSeed}
        seeds={artworkSeeds}
        onSeedChange={vi.fn()}
        parameterValues={{ filamentCount: 200, noiseScale: 0.002, stepLength: 2 }}
        onParameterChange={vi.fn()}
        onSaveImprint={vi.fn()}
        controlStatus="connected"
        saveStatus="idle"
      />,
    )

    expect(markup).toContain('Filament count')
    expect(markup).toContain('value="200"')
    expect(markup).toContain('Noise scale')
    expect(markup).toContain('Step length')
    expect(markup).toContain('Save Imprint')
    expect(markup).toContain('class="connection-indicator-label" aria-hidden="true">API')
    expect(markup).not.toContain('disabled=""')
  })

  it('shows temporary save feedback inside the save button', () => {
    const markup = renderToStaticMarkup(
      <SeedControls
        activeSeed={defaultArtworkSeed}
        seeds={artworkSeeds}
        onSeedChange={vi.fn()}
        parameterValues={{}}
        onParameterChange={vi.fn()}
        onSaveImprint={vi.fn()}
        controlStatus="connected"
        saveStatus="saved"
      />,
    )

    expect(markup).toContain('class="save-feedback save-feedback-saved"')
    expect(markup).toContain('aria-live="polite">Saved')
  })
})

import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import {
  getDefaultGeneValues,
  randomizeGeneValues,
  SeedControls,
} from '../../../../src/ui/artwork/SeedControls'
import { driftingFilamentsSeed } from '../../../../src/seeds/p5/drifting-filaments/seed'
import { artworkSeeds, defaultArtworkSeed } from '../../../../src/seeds/registry'

describe('seed controls', () => {
  it('shows the module selector and registered alternatives without duplicate active-module info', () => {
    const markup = renderToStaticMarkup(
      <SeedControls
        activeSeed={defaultArtworkSeed}
        seeds={artworkSeeds}
        onSeedChange={vi.fn()}
        geneValues={{}}
        onGeneChange={vi.fn()}
        onGenesChange={vi.fn()}
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

  it('renders Gene sliders for the active module', () => {
    const markup = renderToStaticMarkup(
      <SeedControls
        activeSeed={driftingFilamentsSeed}
        seeds={artworkSeeds}
        onSeedChange={vi.fn()}
        geneValues={{ filamentCount: 200, noiseScale: 0.002, stepLength: 2 }}
        onGeneChange={vi.fn()}
        onGenesChange={vi.fn()}
        onSaveImprint={vi.fn()}
        controlStatus="connected"
        saveStatus="idle"
      />,
    )

    expect(markup).toContain('Filament count')
    expect(markup).toContain('value="200"')
    expect(markup).toContain('Genes')
    expect(markup).toContain('Hue')
    expect(markup).toContain('Trail length')
    expect(markup).toContain('Flow scale')
    expect(markup).toContain('Step length')
    expect(markup).toContain('aria-label="Reset genes to defaults"')
    expect(markup).toContain('aria-label="Randomize all genes"')
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
        geneValues={{}}
        onGeneChange={vi.fn()}
        onGenesChange={vi.fn()}
        onSaveImprint={vi.fn()}
        controlStatus="connected"
        saveStatus="saved"
      />,
    )

    expect(markup).toContain('class="save-feedback save-feedback-saved"')
    expect(markup).toContain('aria-live="polite">Saved')
  })

  it('returns the declared defaults for every Gene', () => {
    expect(getDefaultGeneValues(driftingFilamentsSeed.genes)).toEqual(
      Object.fromEntries(
        driftingFilamentsSeed.genes.map(({ id, defaultValue }) => [id, defaultValue]),
      ),
    )
  })

  it('randomizes every Gene to a step-aligned value in its declared range', () => {
    const values = randomizeGeneValues(driftingFilamentsSeed.genes, () => 0.5)

    for (const gene of driftingFilamentsSeed.genes) {
      const value = values[gene.id]
      expect(value).toBeGreaterThanOrEqual(gene.min)
      expect(value).toBeLessThanOrEqual(gene.max)
      expect((value - gene.min) / gene.step).toBeCloseTo(Math.round((value - gene.min) / gene.step))
    }
  })
})

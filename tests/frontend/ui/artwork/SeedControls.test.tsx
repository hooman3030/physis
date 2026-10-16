import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { randomizeGeneValues, rollDie, SeedControls } from '../../../../src/ui/artwork/SeedControls'
import { driftingFilamentsSeed } from '../../../../src/seeds/p5/drifting-filaments/seed'
import { firstOrbitSeed } from '../../../../src/seeds/three/first-orbit/seed'
import { artworkSeeds, defaultArtworkSeed } from '../../../../src/seeds/registry'

describe('seed controls', () => {
  it('shows the module selector and registered alternatives without duplicate active-module info', () => {
    const markup = renderToStaticMarkup(
      <SeedControls
        activeSeed={defaultArtworkSeed}
        seeds={artworkSeeds}
        onSeedChange={vi.fn()}
        auraId={null}
        onAuraChange={vi.fn()}
        toneMappingId={null}
        onToneMappingChange={vi.fn()}
        geneValues={{}}
        onGeneChange={vi.fn()}
        onGenesChange={vi.fn()}
        onResetCanvas={vi.fn()}
        onSaveImprint={vi.fn()}
        controlStatus="offline"
        saveStatus="idle"
      />,
    )

    expect(markup).toContain(defaultArtworkSeed.label)
    expect(markup).toContain('aria-label="Installation control API unavailable"')
    expect(markup).toContain('class="connection-indicator"')
    expect(markup).toContain('class="connection-indicator-label" aria-hidden="true">Offline')
    expect(markup).toContain('surface-transition--open')
    expect(markup).not.toContain('Active module:')
    expect(markup).not.toContain('browser-only controls are active')
    expect(markup).toContain('disabled=""')
    expect(markup).not.toContain('for="aura"')
  })

  it('offers Aura presets only for compatible Three Seeds', () => {
    const markup = renderToStaticMarkup(
      <SeedControls
        activeSeed={firstOrbitSeed}
        seeds={artworkSeeds}
        onSeedChange={vi.fn()}
        auraId="soft-bloom"
        onAuraChange={vi.fn()}
        toneMappingId="agx"
        onToneMappingChange={vi.fn()}
        geneValues={{}}
        onGeneChange={vi.fn()}
        onGenesChange={vi.fn()}
        onResetCanvas={vi.fn()}
        onSaveImprint={vi.fn()}
        controlStatus="connected"
        saveStatus="idle"
      />,
    )

    expect(markup).toContain('class="presentation-selectors"')
    expect(markup).toContain('<label for="aura">Aura</label>')
    expect(markup).toContain('<option value="off">Off</option>')
    expect(markup).toContain('value="soft-bloom" selected="">Soft bloom</option>')
    expect(markup).toContain('<option value="warm-film">Warm film</option>')
    expect(markup).toContain('<option value="prismatic">Prismatic</option>')
    expect(markup).toContain('<option value="vhs">VHS</option>')
    expect(markup).toContain('<option value="dream-haze">Dream haze</option>')
    expect(markup).toContain('<option value="noir">Noir</option>')
    expect(markup).toContain('<label for="tone-mapping">Tone mapping</label>')
    expect(markup).toContain('<option value="agx" selected="">AgX</option>')
    expect(markup).toContain('<option value="neutral">Neutral</option>')
  })

  it('renders Gene sliders for the active module', () => {
    const markup = renderToStaticMarkup(
      <SeedControls
        activeSeed={driftingFilamentsSeed}
        seeds={artworkSeeds}
        onSeedChange={vi.fn()}
        auraId={null}
        onAuraChange={vi.fn()}
        toneMappingId={null}
        onToneMappingChange={vi.fn()}
        geneValues={{ filamentCount: 200, noiseScale: 0.002, stepLength: 2 }}
        onGeneChange={vi.fn()}
        onGenesChange={vi.fn()}
        onResetCanvas={vi.fn()}
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
    expect(markup).not.toContain('Reset genes to defaults')
    expect(markup).toContain('aria-label="Randomize all genes"')
    const geneActionsStart = markup.indexOf('class="gene-actions"')
    const rebirthButtonIndex = markup.indexOf('aria-label="rebirth, R key"')
    const saveButtonIndex = markup.indexOf(
      'class="button--primary button--compact save-imprint save-imprint--idle"',
    )
    const geneActionsEnd = markup.indexOf('</div>', geneActionsStart)
    const geneActionsMarkup = markup.slice(geneActionsStart, geneActionsEnd)

    expect(rebirthButtonIndex).toBeGreaterThan(geneActionsStart)
    expect(rebirthButtonIndex).toBeLessThan(geneActionsEnd)
    expect(saveButtonIndex).toBeGreaterThan(geneActionsStart)
    expect(saveButtonIndex).toBeLessThan(geneActionsEnd)
    expect(geneActionsMarkup).toContain('<kbd class="gene-action-key">r</kbd>')
    expect(geneActionsMarkup).toContain('class="gene-action-icon"')
    expect(geneActionsMarkup).not.toContain('gene-action-icon--rolling')
    expect(geneActionsMarkup).toContain('aria-label="Save Imprint"')
    expect(geneActionsMarkup).toContain('class="save-imprint-icon"')
    expect(markup).toContain('Save Imprint')
    expect(markup).not.toContain('playback-toggle')
    expect(markup).not.toContain('playback-speed')
    expect(markup).toContain('class="connection-indicator-label" aria-hidden="true">API')
    expect(markup).not.toContain('disabled=""')
  })

  it('shows temporary save feedback inside the save button', () => {
    const markup = renderToStaticMarkup(
      <SeedControls
        activeSeed={defaultArtworkSeed}
        seeds={artworkSeeds}
        onSeedChange={vi.fn()}
        auraId={null}
        onAuraChange={vi.fn()}
        toneMappingId={null}
        onToneMappingChange={vi.fn()}
        geneValues={{}}
        onGeneChange={vi.fn()}
        onGenesChange={vi.fn()}
        onResetCanvas={vi.fn()}
        onSaveImprint={vi.fn()}
        controlStatus="connected"
        saveStatus="saved"
      />,
    )

    expect(markup).toContain('class="save-feedback save-feedback-saved"')
    expect(markup).toContain(
      'class="button--primary button--compact save-imprint save-imprint--saved"',
    )
    expect(markup).toContain(
      'd="M6 4.75A1.75 1.75 0 0 1 7.75 3h8.5A1.75 1.75 0 0 1 18 4.75V21l-6-3.5L6 21z"',
    )
    expect(markup).toContain('aria-live="polite">')
    expect(markup).toContain('<span aria-hidden="true">Save</span>')
    expect(markup).toContain('<span class="visually-hidden">Imprint saved</span>')
  })

  it('keeps playback controls out of the Seeds surface', () => {
    const markup = renderToStaticMarkup(
      <SeedControls
        activeSeed={defaultArtworkSeed}
        seeds={artworkSeeds}
        onSeedChange={vi.fn()}
        auraId={null}
        onAuraChange={vi.fn()}
        toneMappingId={null}
        onToneMappingChange={vi.fn()}
        geneValues={{}}
        onGeneChange={vi.fn()}
        onGenesChange={vi.fn()}
        onResetCanvas={vi.fn()}
        onSaveImprint={vi.fn()}
        controlStatus="offline"
        saveStatus="idle"
      />,
    )

    expect(markup).not.toContain('playback-toggle')
    expect(markup).not.toContain('playback-speed')
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

  it('lands the die on each possible face', () => {
    const randomValues = [0, 0.17, 0.34, 0.5, 0.67, 0.99]

    expect(randomValues.map((value) => rollDie(() => value))).toEqual([1, 2, 3, 4, 5, 6])
  })
})

import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { DevelopmentOverlay } from '../../../../src/ui/overlays/DevelopmentOverlay'

describe('development overlay', () => {
  it('shows the measured frame rate in development mode', () => {
    const markup = renderToStaticMarkup(<DevelopmentOverlay fps={60} />)

    expect(markup).toContain('aria-label="Development diagnostics"')
    expect(markup).toContain('aria-label="Frame rate 60 frames per second"')
    expect(markup).toContain('>60</output>')
  })
})

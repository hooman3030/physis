import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { PrimaryButton } from '../../../../src/ui/primitives/PrimaryButton'

describe('primary button', () => {
  it('provides the click animation layer by default', () => {
    const markup = renderToStaticMarkup(
      <PrimaryButton type="button" className="button--compact">
        Apply
      </PrimaryButton>,
    )

    expect(markup).toContain('class="button--primary button--compact"')
    expect(markup).toContain('class="primary-button__fill"')
    expect(markup).toContain('class="primary-button__content">Apply</span>')
  })

  it('allows a button with its own state-driven animation to opt out', () => {
    const markup = renderToStaticMarkup(
      <PrimaryButton type="button" animateOnClick={false}>
        Save
      </PrimaryButton>,
    )

    expect(markup).not.toContain('primary-button__fill')
    expect(markup).toContain('class="primary-button__content">Save</span>')
  })
})

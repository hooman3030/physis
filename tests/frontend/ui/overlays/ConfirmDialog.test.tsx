import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { ConfirmDialog } from '../../../../src/ui/overlays/ConfirmDialog'

describe('ConfirmDialog', () => {
  it('renders an accessible custom alert dialog with cancel and confirm actions', () => {
    const markup = renderToStaticMarkup(
      <ConfirmDialog
        title="Delete this Imprint?"
        description="Descendants will be preserved."
        confirmLabel="Delete Imprint"
        onConfirm={vi.fn(async () => {})}
        onCancel={vi.fn()}
      />,
    )

    expect(markup).toContain('role="alertdialog"')
    expect(markup).toContain('aria-modal="true"')
    expect(markup).toContain('Delete this Imprint?')
    expect(markup).toContain('Descendants will be preserved.')
    expect(markup).toContain('Cancel')
    expect(markup).toContain('Delete Imprint')
    expect(markup).toContain('confirm-dialog-burst')
  })
})

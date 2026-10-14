import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { ErrorToast } from '../../../../src/ui/notifications/ErrorToast'

describe('error toast', () => {
  it('shows persistent, accessible errors with individual dismiss actions', () => {
    const markup = renderToStaticMarkup(
      <ErrorToast
        messages={[
          { id: 1, message: 'Could not delete Imprint: Failed to fetch' },
          { id: 2, message: 'Unexpected asynchronous error: offline' },
        ]}
        onDismiss={vi.fn()}
      />,
    )

    expect(markup.match(/role="alert"/g)).toHaveLength(2)
    expect(markup).toContain('aria-live="assertive"')
    expect(markup).toContain('Could not delete Imprint: Failed to fetch')
    expect(markup).toContain('Unexpected asynchronous error: offline')
    expect(markup).toContain(
      'aria-label="Dismiss error: Could not delete Imprint: Failed to fetch"',
    )
  })

  it('renders nothing when there is no error', () => {
    expect(renderToStaticMarkup(<ErrorToast messages={[]} onDismiss={vi.fn()} />)).toBe('')
  })
})

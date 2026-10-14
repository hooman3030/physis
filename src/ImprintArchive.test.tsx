import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { ImprintArchive } from './ImprintArchive'
import type { ImprintRecord } from './controlClient'

const imprint: ImprintRecord = {
  id: 'imprint-12345678',
  parentId: null,
  codeId: 'first-light',
  sourceRevision: '0123456789abcdef',
  createdAt: '2026-10-14T11:00:00.000Z',
  parameters: { glow: 0.75 },
}

describe('Imprint archive', () => {
  it('renders compact Imprint entries with dates and marks the active entry', () => {
    const markup = renderToStaticMarkup(
      <ImprintArchive
        imprints={[imprint]}
        activeImprintId={imprint.id}
        connected
        loading={false}
        loadFailed={false}
        onSelect={vi.fn()}
        onDelete={vi.fn()}
      />,
    )

    expect(markup).toContain('1 saved Imprint')
    expect(markup).toContain('first-light')
    expect(markup).toContain('dateTime="2026-10-14T11:00:00.000Z"')
    expect(markup).not.toContain('glow: 0.75')
    expect(markup).toContain('aria-pressed="true"')
    expect(markup).not.toContain('imprint-active')
    expect(markup).not.toContain('>Active<')
    expect(markup).toContain('Select another Imprint before deleting this one')
    expect(markup).not.toContain('Parent ')
    expect(markup).not.toContain('revision ')
    expect(markup).not.toContain('Refresh')
  })

  it('explains when the API is unavailable and disables archive actions', () => {
    const markup = renderToStaticMarkup(
      <ImprintArchive
        imprints={[imprint]}
        activeImprintId={null}
        connected={false}
        loading={false}
        loadFailed={false}
        onSelect={vi.fn()}
        onDelete={vi.fn()}
      />,
    )

    expect(markup).toContain('Connect to the local control API to browse Imprints')
    expect(markup).toContain('disabled=""')
  })
})

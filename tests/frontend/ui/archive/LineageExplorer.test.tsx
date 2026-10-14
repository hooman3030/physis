import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { CodeNodeRecord, ImprintRecord } from '../../../../src/controlClient'
import { LineageExplorer } from '../../../../src/ui/archive/LineageExplorer'

const codeNodes: CodeNodeRecord[] = [
  {
    id: 'first-light',
    parentId: null,
    role: 'seed',
    sourceRevision: '0123456789abcdef',
    promotedAt: '2026-10-14T11:00:00.000Z',
    createdAt: '2026-10-14T11:00:00.000Z',
    available: true,
  },
  {
    id: 'mutation-1',
    parentId: 'first-light',
    role: 'mutation',
    sourceRevision: 'fedcba9876543210',
    promotedAt: null,
    createdAt: '2026-10-14T12:00:00.000Z',
    available: false,
  },
]

const imprints: ImprintRecord[] = [
  {
    id: 'imprint-root',
    parentId: null,
    codeId: 'first-light',
    sourceRevision: '0123456789abcdef',
    createdAt: '2026-10-14T11:30:00.000Z',
    genes: { glow: 0.5 },
  },
  {
    id: 'imprint-child',
    parentId: 'imprint-root',
    codeId: 'mutation-1',
    sourceRevision: 'fedcba9876543210',
    createdAt: '2026-10-14T12:30:00.000Z',
    genes: { glow: 0.75 },
  },
]

describe('Lineage Explorer', () => {
  it('labels code parents, Imprint parents, and code references as distinct relationships', () => {
    const markup = renderToStaticMarkup(
      <LineageExplorer
        codeNodes={codeNodes}
        imprints={imprints}
        presence={null}
        selection={{ kind: 'imprint', id: 'imprint-child' }}
        controlStatus="connected"
        loading={false}
        loadFailed={false}
        authenticationRequired={false}
        onSelect={vi.fn()}
        onActivate={vi.fn()}
        onRetry={vi.fn()}
      />,
    )

    expect(markup).toContain('Code parent: first-light to mutation-1')
    expect(markup).toContain('Imprint parent: imprint-root to imprint-child')
    expect(markup).toContain('Code reference: imprint-child to mutation-1')
    expect(markup).toContain('IMPRINT LINEAGE')
    expect(markup).toContain('Its code is not available in this build')
    expect(markup).toContain('disabled=""')
  })

  it('keeps the artwork on its own route and provides a route back', () => {
    const markup = renderToStaticMarkup(
      <LineageExplorer
        codeNodes={[]}
        imprints={[]}
        presence={null}
        selection={null}
        controlStatus="connecting"
        loading
        loadFailed={false}
        authenticationRequired={false}
        onSelect={vi.fn()}
        onActivate={vi.fn()}
        onRetry={vi.fn()}
      />,
    )

    expect(markup).toContain('href="/"')
    expect(markup).toContain('Lineage Explorer')
    expect(markup).toContain('Loading the archive')
  })
})

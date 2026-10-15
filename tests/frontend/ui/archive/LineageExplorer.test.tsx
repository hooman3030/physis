import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { CodeNodeRecord, ImprintRecord, PresenceSnapshot } from '../../../../src/controlClient'
import {
  getInitialLineageSelection,
  LineageExplorer,
  shouldActivateLineageSelection,
} from '../../../../src/ui/archive/LineageExplorer'
import { wheelZoomFactor } from '../../../../src/ui/archive/LineageGraphView'

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

const presenceWithImprint: PresenceSnapshot = {
  revision: 1,
  paused: false,
  speed: 1,
  code: { id: 'first-light' },
  imprint: { id: 'imprint-root' },
  module: null,
  genes: null,
}

describe('Lineage Explorer', () => {
  it('initially selects the active Imprint when it exists in the archive', () => {
    expect(getInitialLineageSelection(presenceWithImprint, imprints)).toEqual({
      kind: 'imprint',
      id: 'imprint-root',
    })
    expect(
      getInitialLineageSelection({ ...presenceWithImprint, imprint: null }, imprints),
    ).toBeNull()
    expect(
      getInitialLineageSelection({ ...presenceWithImprint, imprint: { id: 'missing' } }, imprints),
    ).toBeNull()
  })

  it('activates available selections unless already active', () => {
    expect(
      shouldActivateLineageSelection(
        { kind: 'imprint', id: 'imprint-root' },
        null,
        codeNodes,
        imprints,
        'connected',
      ),
    ).toBe(true)
    expect(
      shouldActivateLineageSelection(
        { kind: 'imprint', id: 'imprint-root' },
        presenceWithImprint,
        codeNodes,
        imprints,
        'connected',
      ),
    ).toBe(false)
    expect(
      shouldActivateLineageSelection(
        { kind: 'code', id: 'first-light' },
        presenceWithImprint,
        codeNodes,
        imprints,
        'connected',
      ),
    ).toBe(true)
    expect(
      shouldActivateLineageSelection(
        { kind: 'code', id: 'mutation-1' },
        null,
        codeNodes,
        imprints,
        'connected',
      ),
    ).toBe(false)
    expect(
      shouldActivateLineageSelection(
        { kind: 'code', id: 'first-light' },
        null,
        codeNodes,
        imprints,
        'offline',
      ),
    ).toBe(false)
  })

  it('renders root Imprints as parented to their source code without reference edges', () => {
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

    expect(markup).toContain('Parent: first-light to imprint-root')
    expect(markup).toContain('Parent: imprint-root to imprint-child')
    expect(markup).not.toContain('Code reference')
    expect(markup).not.toContain('IMPRINT LINEAGE')
    expect(markup).not.toContain('Follow code and Imprint ancestry')
    expect(markup).not.toContain('2 code nodes and 2 Imprints')
    expect(markup).not.toContain('Selected archive node')
    expect(markup).toContain('lineage-graph-backdrop')
    expect(markup).toContain('lineage-graph-node-selected')
    expect(markup).toContain('scale(1.33)')
    expect(markup).toContain('markerWidth="2"')
    expect(markup).toContain('class="button--quiet"')
    expect(markup).not.toContain('Use in Presence')
    expect(markup).toContain('Reset layout')
    expect(markup).not.toContain('disabled=""')
  })

  it('uses gentle, delta-scaled wheel zoom', () => {
    expect(wheelZoomFactor(100)).toBeCloseTo(0.9512, 3)
    expect(wheelZoomFactor(-100)).toBeCloseTo(1.0513, 3)
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

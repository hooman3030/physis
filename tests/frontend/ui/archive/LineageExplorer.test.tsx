import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { CodeNodeRecord, ImprintRecord, PresenceSnapshot } from '../../../../src/controlClient'
import {
  getInitialLineageSelection,
  LineageExplorer,
  shouldActivateLineageSelection,
} from '../../../../src/ui/archive/LineageExplorer'
import {
  canDeleteLineageNode,
  getLineageGraphSelectionAction,
  toggleDeleteSelection,
  wheelZoomFactor,
} from '../../../../src/ui/archive/LineageGraphView'
import { createLineageGraph } from '../../../../src/ui/archive/lineageGraph'

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

  it('only allows inactive Imprints in delete mode and toggles multi-selection', () => {
    const graph = createLineageGraph(codeNodes, imprints)
    const activeImprint = graph.nodes.find((node) => node.key === 'imprint:imprint-root')
    const inactiveImprint = graph.nodes.find((node) => node.key === 'imprint:imprint-child')
    const codeNode = graph.nodes.find((node) => node.key === 'code:first-light')
    if (activeImprint === undefined || inactiveImprint === undefined || codeNode === undefined) {
      throw new Error('Expected delete-mode test nodes to exist')
    }

    expect(canDeleteLineageNode(activeImprint, presenceWithImprint)).toBe(false)
    expect(canDeleteLineageNode(inactiveImprint, presenceWithImprint)).toBe(true)
    expect(canDeleteLineageNode(codeNode, presenceWithImprint)).toBe(false)
    expect(
      getLineageGraphSelectionAction(
        { kind: 'imprint', id: 'imprint-child' },
        true,
        graph.nodes,
        presenceWithImprint,
      ),
    ).toEqual({ type: 'toggle-delete', imprintId: 'imprint-child' })
    expect(
      getLineageGraphSelectionAction(
        { kind: 'imprint', id: 'imprint-root' },
        true,
        graph.nodes,
        presenceWithImprint,
      ),
    ).toEqual({ type: 'ignore' })
    expect(
      getLineageGraphSelectionAction(
        { kind: 'imprint', id: 'imprint-child' },
        false,
        graph.nodes,
        presenceWithImprint,
      ),
    ).toEqual({
      type: 'activate',
      selection: { kind: 'imprint', id: 'imprint-child' },
    })

    const selected = toggleDeleteSelection(new Set(), 'imprint-child')
    expect(selected).toEqual(new Set(['imprint-child']))
    expect(toggleDeleteSelection(selected, 'imprint-child')).toEqual(new Set())
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
        onDeleteImprints={vi.fn(async () => [])}
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
    expect(markup).toContain('role="switch"')
    expect(markup).toContain('aria-label="Delete"')
    expect(markup).toContain('lineage-graph-node-selected')
    expect(markup).toContain('scale(1.33)')
    expect(markup).toContain('markerWidth="2"')
    expect(markup).toContain('class="button--quiet"')
    expect(markup).not.toContain('Use in Presence')
    expect(markup).toContain('Reset layout')
    expect(markup).toContain(
      'class="button--quiet lineage-graph-delete-action lineage-graph-delete-action-hidden"',
    )
    expect(markup).toContain('aria-hidden="true"')
    expect(markup).toContain('aria-label="Delete mode selection count"')
    expect(markup).toContain('aria-checked="false"')
    expect(markup).toContain('disabled=""')
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
        onDeleteImprints={vi.fn(async () => [])}
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

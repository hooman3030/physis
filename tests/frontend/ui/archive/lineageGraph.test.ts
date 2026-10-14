import { describe, expect, it } from 'vitest'
import type { CodeNodeRecord, ImprintRecord } from '../../../../src/controlClient'
import { createLineageGraph, layoutLineageGraph } from '../../../../src/ui/archive/lineageGraph'

const codeNodes: CodeNodeRecord[] = [
  {
    id: 'seed-a',
    parentId: null,
    role: 'seed',
    sourceRevision: '0123456789abcdef',
    promotedAt: '2026-10-14T11:00:00.000Z',
    createdAt: '2026-10-14T11:00:00.000Z',
    available: true,
  },
  {
    id: 'mutation-a',
    parentId: 'seed-a',
    role: 'mutation',
    sourceRevision: 'fedcba9876543210',
    promotedAt: null,
    createdAt: '2026-10-14T12:00:00.000Z',
    available: false,
  },
]

const imprints: ImprintRecord[] = [
  {
    id: 'imprint-a',
    parentId: null,
    codeId: 'seed-a',
    sourceRevision: '0123456789abcdef',
    createdAt: '2026-10-14T11:30:00.000Z',
    genes: {},
  },
  {
    id: 'imprint-b',
    parentId: 'imprint-a',
    codeId: 'mutation-a',
    sourceRevision: 'fedcba9876543210',
    createdAt: '2026-10-14T12:30:00.000Z',
    genes: {},
  },
]

describe('lineage graph model', () => {
  it('keeps code parents, Imprint parents, and code references as separate edges', () => {
    const graph = createLineageGraph(codeNodes, imprints)

    expect(graph.edges).toHaveLength(4)
    expect(graph.edges).toEqual(
      expect.arrayContaining([
        { from: 'code:seed-a', to: 'code:mutation-a', kind: 'code-parent' },
        { from: 'imprint:imprint-a', to: 'imprint:imprint-b', kind: 'imprint-parent' },
        { from: 'imprint:imprint-a', to: 'code:seed-a', kind: 'code-reference' },
        { from: 'imprint:imprint-b', to: 'code:mutation-a', kind: 'code-reference' },
      ]),
    )
  })

  it('lays parent nodes before their descendants in stable, separate lanes', () => {
    const layout = layoutLineageGraph(createLineageGraph(codeNodes, imprints))
    const codeParent = layout.positions.get('code:seed-a')
    const codeChild = layout.positions.get('code:mutation-a')
    const imprintParent = layout.positions.get('imprint:imprint-a')
    const imprintChild = layout.positions.get('imprint:imprint-b')

    expect(codeParent).toBeDefined()
    expect(codeChild).toBeDefined()
    expect(imprintParent).toBeDefined()
    expect(imprintChild).toBeDefined()
    expect(codeParent?.x).toBeLessThan(codeChild?.x ?? 0)
    expect(imprintParent?.x).toBeLessThan(imprintChild?.x ?? 0)
    expect(codeParent?.y).toBeLessThan(layout.codeLane.bottom)
    expect(imprintParent?.y).toBeGreaterThan(layout.imprintLane.top)
    expect(layout.width).toBeGreaterThan(0)
    expect(layout.height).toBeGreaterThan(layout.imprintLane.bottom)
  })
})

import { describe, expect, it } from 'vitest'
import type { CodeNodeRecord, ImprintRecord } from '../../../../src/controlClient'
import {
  createInitialLineagePositions,
  createLineageGraph,
  graphDimensions,
} from '../../../../src/ui/archive/lineageGraph'
import { createLineageLayoutSimulation } from '../../../../src/ui/archive/lineageLayout'

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
  it('connects root Imprints to their source code and removes code-reference edges', () => {
    const graph = createLineageGraph(codeNodes, imprints)

    expect(graph.edges).toHaveLength(3)
    expect(graph.edges).toEqual(
      expect.arrayContaining([
        { from: 'code:seed-a', to: 'code:mutation-a' },
        { from: 'code:seed-a', to: 'imprint:imprint-a' },
        { from: 'imprint:imprint-a', to: 'imprint:imprint-b' },
      ]),
    )
  })

  it('creates deterministic organic positions without duplicating saved node coordinates', () => {
    const graph = createLineageGraph(codeNodes, imprints)
    const dimensions = graphDimensions(graph.nodes.length)
    const saved = new Map([['code:seed-a', { x: 300, y: 240 }]])
    const firstPositions = createInitialLineagePositions(graph.nodes, dimensions, saved)
    const secondPositions = createInitialLineagePositions(graph.nodes, dimensions, saved)

    expect(firstPositions).toEqual(secondPositions)
    expect(firstPositions.get('code:seed-a')).toEqual({ x: 300, y: 240 })
    expect(firstPositions.size).toBe(graph.nodes.length)
    expect(dimensions.width).toBeGreaterThan(0)
    expect(dimensions.height).toBeGreaterThan(0)
  })

  it('settles the same graph into the same force layout', () => {
    const graph = createLineageGraph(codeNodes, imprints)
    const dimensions = graphDimensions(graph.nodes.length)
    const settle = () => {
      const { nodes, simulation } = createLineageLayoutSimulation(graph, dimensions, new Map())
      simulation.stop().tick(140)
      const positions = new Map(nodes.map((node) => [node.key, { x: node.x, y: node.y }]))
      simulation.stop()
      return positions
    }

    expect(settle()).toEqual(settle())
  })
})

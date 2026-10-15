import { describe, expect, it } from 'vitest'
import type { CodeNodeRecord, ImprintRecord } from '../../../../src/controlClient'
import {
  createChronologicalYTargets,
  createInitialLineagePositions,
  createLineageGraph,
  createLineageXTargets,
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

function makeChronologicalCodeNodes(count: number): CodeNodeRecord[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `node-${index}`,
    parentId: index === 0 ? null : `node-${index - 1}`,
    role: index === 0 ? ('seed' as const) : ('mutation' as const),
    sourceRevision: index.toString(16).padStart(16, '0'),
    promotedAt: index === 0 ? '2026-10-14T11:00:00.000Z' : null,
    createdAt: new Date(Date.UTC(2026, 9, 14, 11, index)).toISOString(),
    available: true,
  }))
}

function makeCrowdedImprints(count: number): ImprintRecord[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `imprint-${index}`,
    parentId: index === 0 ? null : 'imprint-0',
    codeId: 'seed-a',
    sourceRevision: index.toString(16).padStart(16, '0'),
    createdAt: new Date(Date.UTC(2026, 9, 14, 12, index)).toISOString(),
    genes: {},
  }))
}

function makeBranchingImprints(): ImprintRecord[] {
  const makeImprint = (id: string, parentId: string | null, minute: number): ImprintRecord => ({
    id,
    parentId,
    codeId: 'seed-a',
    sourceRevision: '0123456789abcdef',
    createdAt: new Date(Date.UTC(2026, 9, 14, 12, minute)).toISOString(),
    genes: {},
  })
  return [
    makeImprint('imprint-root', null, 0),
    makeImprint('imprint-left', 'imprint-root', 10),
    makeImprint('imprint-middle', 'imprint-root', 20),
    makeImprint('imprint-right', 'imprint-root', 30),
    makeImprint('imprint-left-child', 'imprint-left', 40),
    makeImprint('imprint-right-child', 'imprint-right', 50),
  ]
}

function segmentsCross(
  firstStart: { x: number; y: number },
  firstEnd: { x: number; y: number },
  secondStart: { x: number; y: number },
  secondEnd: { x: number; y: number },
): boolean {
  const orientation = (
    start: { x: number; y: number },
    end: { x: number; y: number },
    point: { x: number; y: number },
  ) => (end.x - start.x) * (point.y - start.y) - (end.y - start.y) * (point.x - start.x)
  return (
    orientation(firstStart, firstEnd, secondStart) * orientation(firstStart, firstEnd, secondEnd) <
      0 &&
    orientation(secondStart, secondEnd, firstStart) *
      orientation(secondStart, secondEnd, firstEnd) <
      0
  )
}

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

  it('falls back to an Imprint’s source-code lineage when its parent is missing', () => {
    const orphan = {
      id: 'orphan',
      parentId: 'deleted-imprint',
      codeId: 'mutation-a',
      sourceRevision: 'fedcba9876543210',
      createdAt: '2026-10-14T13:00:00.000Z',
      genes: {},
    }
    const graph = createLineageGraph(codeNodes, [...imprints, orphan])

    expect(graph.edges).toEqual(
      expect.arrayContaining([
        { from: 'code:seed-a', to: 'code:mutation-a' },
        { from: 'code:mutation-a', to: 'imprint:orphan' },
      ]),
    )
  })

  it('creates deterministic organic positions without duplicating saved node coordinates', () => {
    const graph = createLineageGraph(codeNodes, imprints)
    const dimensions = graphDimensions(graph.nodes.length)
    const saved = new Map([['code:seed-a', { x: 300, y: 240 }]])
    const firstPositions = createInitialLineagePositions(
      graph.nodes,
      dimensions,
      saved,
      graph.edges,
    )
    const secondPositions = createInitialLineagePositions(
      graph.nodes,
      dimensions,
      saved,
      graph.edges,
    )

    expect(firstPositions).toEqual(secondPositions)
    expect(firstPositions.get('code:seed-a')).toEqual({ x: 300, y: 240 })
    expect(firstPositions.size).toBe(graph.nodes.length)
    expect(dimensions.width).toBeGreaterThan(0)
    expect(dimensions.height).toBeGreaterThan(0)
  })

  it('starts older nodes above newer nodes', () => {
    const graph = createLineageGraph(codeNodes, imprints)
    const dimensions = graphDimensions(graph.nodes.length)
    const positions = createInitialLineagePositions(graph.nodes, dimensions)
    const orderedNodes = [...graph.nodes].sort(
      (left, right) =>
        left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id),
    )

    expect(
      orderedNodes.every(
        (node, index) =>
          index === 0 ||
          (positions.get(orderedNodes[index - 1]?.key ?? '')?.y ?? Infinity) <
            (positions.get(node.key)?.y ?? -Infinity),
      ),
    ).toBe(true)
  })

  it('orders sibling branches and keeps their lineage edges from crossing', () => {
    const graph = createLineageGraph(codeNodes.slice(0, 1), makeBranchingImprints())
    const dimensions = graphDimensions(graph.nodes.length)
    const xTargets = createLineageXTargets(graph.nodes, graph.edges, dimensions.width)
    const layout = createLineageLayoutSimulation(graph, dimensions, new Map())
    layout.simulation.stop().tick(180)
    const positions = new Map(
      layout.nodes.map((node) => [node.key, { x: node.x ?? 0, y: node.y ?? 0 }]),
    )

    const left = positions.get('imprint:imprint-left')
    const middle = positions.get('imprint:imprint-middle')
    const right = positions.get('imprint:imprint-right')
    expect(left?.x).toBeLessThan(middle?.x ?? Infinity)
    expect(middle?.x).toBeLessThan(right?.x ?? Infinity)
    expect(xTargets.get('imprint:imprint-left')).toBeLessThan(
      xTargets.get('imprint:imprint-middle') ?? Infinity,
    )
    expect(xTargets.get('imprint:imprint-middle')).toBeLessThan(
      xTargets.get('imprint:imprint-right') ?? Infinity,
    )

    for (let first = 0; first < graph.edges.length; first += 1) {
      for (let second = first + 1; second < graph.edges.length; second += 1) {
        const firstEdge = graph.edges[first]
        const secondEdge = graph.edges[second]
        if (
          firstEdge === undefined ||
          secondEdge === undefined ||
          firstEdge.from === secondEdge.from ||
          firstEdge.from === secondEdge.to ||
          firstEdge.to === secondEdge.from ||
          firstEdge.to === secondEdge.to
        ) {
          continue
        }
        const firstStart = positions.get(firstEdge.from)
        const firstEnd = positions.get(firstEdge.to)
        const secondStart = positions.get(secondEdge.from)
        const secondEnd = positions.get(secondEdge.to)
        if (
          firstStart === undefined ||
          firstEnd === undefined ||
          secondStart === undefined ||
          secondEnd === undefined
        ) {
          continue
        }
        expect(segmentsCross(firstStart, firstEnd, secondStart, secondEnd)).toBe(false)
      }
    }
    layout.simulation.stop()
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

    const positions = settle()
    expect(positions).toEqual(settle())

    const targets = createChronologicalYTargets(graph.nodes, dimensions.height)
    const orderedNodes = [...graph.nodes].sort(
      (left, right) =>
        left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id),
    )
    const first = orderedNodes[0]
    const last = orderedNodes.at(-1)
    expect(first).toBeDefined()
    expect(last).toBeDefined()
    expect(targets.get(first?.key ?? '')).toBeLessThan(targets.get(last?.key ?? '') ?? Infinity)
    expect(positions.get(first?.key ?? '')?.y).toBeLessThan(
      positions.get(last?.key ?? '')?.y ?? Infinity,
    )
  })

  it('spreads a larger lineage while keeping older nodes generally higher', () => {
    const graph = createLineageGraph(makeChronologicalCodeNodes(16), [])
    const dimensions = graphDimensions(graph.nodes.length)
    const layout = createLineageLayoutSimulation(graph, dimensions, new Map())
    layout.simulation.stop().tick(180)

    const settled = [...layout.nodes].sort(
      (left, right) =>
        left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id),
    )
    const oldestGroup = settled.slice(0, settled.length / 4)
    const newestGroup = settled.slice(-settled.length / 4)
    const averageY = (group: typeof settled) =>
      group.reduce((sum, node) => sum + (node.y ?? 0), 0) / group.length
    let closestPair = Infinity
    for (let left = 0; left < layout.nodes.length; left += 1) {
      for (let right = left + 1; right < layout.nodes.length; right += 1) {
        const first = layout.nodes[left]
        const second = layout.nodes[right]
        if (first === undefined || second === undefined) continue
        closestPair = Math.min(
          closestPair,
          Math.hypot((first.x ?? 0) - (second.x ?? 0), (first.y ?? 0) - (second.y ?? 0)),
        )
      }
    }
    layout.simulation.stop()

    expect(averageY(oldestGroup)).toBeLessThan(averageY(newestGroup))
    expect(closestPair).toBeGreaterThan(80)
  })

  it('reflows saved Imprint positions and separates crowded siblings', () => {
    const graph = createLineageGraph(codeNodes.slice(0, 1), makeCrowdedImprints(16))
    const dimensions = graphDimensions(graph.nodes.length)
    const savedPositions = new Map(graph.nodes.map((node) => [node.key, { x: 500, y: 500 }]))
    const layout = createLineageLayoutSimulation(graph, dimensions, savedPositions)
    expect(layout.nodes.every((node) => node.fx === undefined && node.fy === undefined)).toBe(true)
    layout.simulation.stop().tick(220)

    const imprintNodes = layout.nodes.filter((node) => node.kind === 'imprint')
    let closestPair = Infinity
    for (let left = 0; left < imprintNodes.length; left += 1) {
      for (let right = left + 1; right < imprintNodes.length; right += 1) {
        const first = imprintNodes[left]
        const second = imprintNodes[right]
        if (first === undefined || second === undefined) continue
        closestPair = Math.min(
          closestPair,
          Math.hypot((first.x ?? 0) - (second.x ?? 0), (first.y ?? 0) - (second.y ?? 0)),
        )
      }
    }
    const orderedImprints = [...imprintNodes].sort(
      (left, right) =>
        left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id),
    )
    const oldest = orderedImprints[0]
    const newest = orderedImprints.at(-1)
    layout.simulation.stop()

    expect(layout.nodes.some((node) => node.x !== 500 || node.y !== 500)).toBe(true)
    expect(closestPair).toBeGreaterThan(100)
    expect(oldest?.y).toBeLessThan(newest?.y ?? Infinity)
  })
})

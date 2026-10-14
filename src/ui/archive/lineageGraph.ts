import type { CodeNodeRecord, ImprintRecord } from '../../controlClient'

export type LineageGraphNode = {
  key: string
  id: string
  kind: 'code' | 'imprint'
  role: 'seed' | 'mutation' | 'imprint'
  parentId: string | null
  codeId: string | null
  sourceRevision: string
  createdAt: string
  available: boolean
}

export type LineageGraphEdge = {
  from: string
  to: string
  kind: 'code-parent' | 'imprint-parent' | 'code-reference'
}

export type LineageGraph = {
  nodes: readonly LineageGraphNode[]
  edges: readonly LineageGraphEdge[]
}

export type GraphPosition = {
  x: number
  y: number
}

export type LineageGraphLayout = {
  positions: ReadonlyMap<string, GraphPosition>
  width: number
  height: number
  codeLane: { top: number; bottom: number }
  imprintLane: { top: number; bottom: number }
}

const LEFT_MARGIN = 120
const COLUMN_GAP = 210
const ROW_GAP = 142
const NODE_RADIUS = 40
const LANE_GAP = 110

function sortByTimeAndId<T extends { createdAt: string; id: string }>(left: T, right: T) {
  return left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id)
}

export function createLineageGraph(
  codeNodes: readonly CodeNodeRecord[],
  imprints: readonly ImprintRecord[],
): LineageGraph {
  const codeKeys = new Set(codeNodes.map((node) => `code:${node.id}`))
  const imprintKeys = new Set(imprints.map((imprint) => `imprint:${imprint.id}`))
  const nodes: LineageGraphNode[] = [
    ...codeNodes.map((node) => ({
      key: `code:${node.id}`,
      id: node.id,
      kind: 'code' as const,
      role: node.role,
      parentId: node.parentId,
      codeId: null,
      sourceRevision: node.sourceRevision,
      createdAt: node.createdAt,
      available: node.available,
    })),
    ...imprints.map((imprint) => ({
      key: `imprint:${imprint.id}`,
      id: imprint.id,
      kind: 'imprint' as const,
      role: 'imprint' as const,
      parentId: imprint.parentId,
      codeId: imprint.codeId,
      sourceRevision: imprint.sourceRevision,
      createdAt: imprint.createdAt,
      available: false,
    })),
  ]
  const edges: LineageGraphEdge[] = []

  for (const node of codeNodes) {
    if (node.parentId !== null && codeKeys.has(`code:${node.parentId}`)) {
      edges.push({
        from: `code:${node.parentId}`,
        to: `code:${node.id}`,
        kind: 'code-parent',
      })
    }
  }

  for (const imprint of imprints) {
    if (imprint.parentId !== null && imprintKeys.has(`imprint:${imprint.parentId}`)) {
      edges.push({
        from: `imprint:${imprint.parentId}`,
        to: `imprint:${imprint.id}`,
        kind: 'imprint-parent',
      })
    }
    if (codeKeys.has(`code:${imprint.codeId}`)) {
      edges.push({
        from: `imprint:${imprint.id}`,
        to: `code:${imprint.codeId}`,
        kind: 'code-reference',
      })
    }
  }

  return { nodes, edges }
}

function layoutLane(
  nodes: readonly LineageGraphNode[],
  edges: readonly LineageGraphEdge[],
  edgeKind: 'code-parent' | 'imprint-parent',
  top: number,
): { positions: Map<string, GraphPosition>; bottom: number; maxDepth: number } {
  const laneKeys = new Set(nodes.map((node) => node.key))
  const childKeys = new Map<string, string[]>()
  const childOf = new Map<string, string>()
  const nodesByKey = new Map(nodes.map((node) => [node.key, node]))

  for (const edge of edges) {
    if (edge.kind !== edgeKind || !laneKeys.has(edge.from) || !laneKeys.has(edge.to)) continue
    const children = childKeys.get(edge.from) ?? []
    children.push(edge.to)
    childKeys.set(edge.from, children)
    childOf.set(edge.to, edge.from)
  }

  const compareKeys = (leftKey: string, rightKey: string) => {
    const left = nodesByKey.get(leftKey)
    const right = nodesByKey.get(rightKey)
    if (left === undefined || right === undefined) return leftKey.localeCompare(rightKey)
    return sortByTimeAndId(left, right)
  }

  for (const children of childKeys.values()) children.sort(compareKeys)

  const roots = nodes
    .filter((node) => !childOf.has(node.key))
    .map((node) => node.key)
    .sort(compareKeys)
  const positions = new Map<string, GraphPosition>()
  const visiting = new Set<string>()
  let leafIndex = 0
  let maxDepth = 0

  const place = (key: string, depth: number): GraphPosition | null => {
    const existing = positions.get(key)
    if (existing !== undefined) return existing
    if (visiting.has(key)) return null
    visiting.add(key)
    maxDepth = Math.max(maxDepth, depth)
    const childPositions = (childKeys.get(key) ?? [])
      .map((childKey) => place(childKey, depth + 1))
      .filter((position): position is GraphPosition => position !== null)
    visiting.delete(key)

    const y =
      childPositions.length > 0
        ? childPositions.reduce((sum, position) => sum + position.y, 0) / childPositions.length
        : top + 112 + leafIndex++ * ROW_GAP
    const position = { x: LEFT_MARGIN + depth * COLUMN_GAP, y }
    positions.set(key, position)
    return position
  }

  for (const key of roots) place(key, 0)
  for (const node of [...nodes].sort(sortByTimeAndId)) {
    if (!positions.has(node.key)) place(node.key, 0)
  }

  const bottom =
    positions.size === 0
      ? top + 160
      : Math.max(...[...positions.values()].map((position) => position.y)) + NODE_RADIUS + 38
  return { positions, bottom, maxDepth }
}

export function layoutLineageGraph(graph: LineageGraph): LineageGraphLayout {
  const codeNodes = graph.nodes.filter((node) => node.kind === 'code')
  const imprintNodes = graph.nodes.filter((node) => node.kind === 'imprint')
  const codeLane = layoutLane(codeNodes, graph.edges, 'code-parent', 0)
  const imprintTop = codeLane.bottom + LANE_GAP
  const imprintLane = layoutLane(imprintNodes, graph.edges, 'imprint-parent', imprintTop)
  const positions = new Map([...codeLane.positions, ...imprintLane.positions])
  const maxDepth = Math.max(codeLane.maxDepth, imprintLane.maxDepth)

  return {
    positions,
    width: Math.max(1000, LEFT_MARGIN * 2 + maxDepth * COLUMN_GAP),
    height: imprintLane.bottom + 38,
    codeLane: { top: 20, bottom: codeLane.bottom + 24 },
    imprintLane: { top: imprintTop + 20, bottom: imprintLane.bottom + 24 },
  }
}

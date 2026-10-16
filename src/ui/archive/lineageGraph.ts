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
}

export type LineageGraph = {
  nodes: readonly LineageGraphNode[]
  edges: readonly LineageGraphEdge[]
}

export type GraphPosition = {
  x: number
  y: number
}

export type GraphDimensions = {
  width: number
  height: number
}

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
  ].sort(sortByTimeAndId)
  const edges: LineageGraphEdge[] = []

  for (const node of codeNodes) {
    if (node.parentId !== null && codeKeys.has(`code:${node.parentId}`)) {
      edges.push({ from: `code:${node.parentId}`, to: `code:${node.id}` })
    }
  }

  for (const imprint of imprints) {
    const parentKey = imprint.parentId === null ? null : `imprint:${imprint.parentId}`
    if (parentKey !== null && imprintKeys.has(parentKey)) {
      edges.push({ from: parentKey, to: `imprint:${imprint.id}` })
    } else if (codeKeys.has(`code:${imprint.codeId}`)) {
      edges.push({ from: `code:${imprint.codeId}`, to: `imprint:${imprint.id}` })
    }
  }

  return { nodes, edges }
}

export function graphDimensions(nodeCount: number): GraphDimensions {
  const side = Math.max(680, Math.ceil(Math.sqrt(Math.max(nodeCount, 1))) * 190)
  return { width: side + 320, height: side + 120 }
}

export function createChronologicalYTargets(
  nodes: readonly LineageGraphNode[],
  height: number,
): Map<string, number> {
  const orderedNodes = [...nodes].sort(sortByTimeAndId)
  const margin = Math.min(110, height * 0.15)
  const span = Math.max(0, height - margin * 2)
  return new Map(
    orderedNodes.map((node, index) => [
      node.key,
      orderedNodes.length < 2 ? height / 2 : margin + (span * index) / (orderedNodes.length - 1),
    ]),
  )
}

export function createLineageXTargets(
  nodes: readonly LineageGraphNode[],
  edges: readonly LineageGraphEdge[],
  width: number,
): Map<string, number> {
  const nodesByKey = new Map(nodes.map((node) => [node.key, node]))
  const childKeys = new Map<string, string[]>()
  const nodesWithParents = new Set<string>()
  for (const edge of edges) {
    if (!nodesByKey.has(edge.from) || !nodesByKey.has(edge.to) || edge.from === edge.to) continue
    const children = childKeys.get(edge.from) ?? []
    children.push(edge.to)
    childKeys.set(edge.from, children)
    nodesWithParents.add(edge.to)
  }

  const compareKeys = (leftKey: string, rightKey: string) => {
    const left = nodesByKey.get(leftKey)
    const right = nodesByKey.get(rightKey)
    if (left === undefined || right === undefined) return leftKey.localeCompare(rightKey)
    return sortByTimeAndId(left, right)
  }
  for (const children of childKeys.values()) children.sort(compareKeys)

  const ranges = new Map<string, { first: number; last: number }>()
  const visiting = new Set<string>()
  let leafIndex = 0
  const assignSubtree = (key: string): { first: number; last: number } => {
    const existing = ranges.get(key)
    if (existing !== undefined) return existing
    if (visiting.has(key)) {
      const index = leafIndex++
      return { first: index, last: index }
    }
    visiting.add(key)
    const children = childKeys.get(key) ?? []
    let range: { first: number; last: number }
    if (children.length === 0) {
      const index = leafIndex++
      range = { first: index, last: index }
    } else {
      const childRanges = children.map(assignSubtree)
      range = {
        first: childRanges[0]?.first ?? leafIndex,
        last: childRanges.at(-1)?.last ?? leafIndex,
      }
    }
    visiting.delete(key)
    ranges.set(key, range)
    return range
  }

  const roots = nodes.filter((node) => !nodesWithParents.has(node.key)).sort(sortByTimeAndId)
  roots.forEach((node, index) => {
    if (index > 0) leafIndex += 1
    assignSubtree(node.key)
  })
  for (const node of [...nodes].sort(sortByTimeAndId)) assignSubtree(node.key)

  const leafCount = leafIndex
  const sideMargin = Math.min(140, width * 0.15)
  const span = Math.max(0, width - sideMargin * 2)
  return new Map(
    [...ranges].map(([key, range]) => [
      key,
      leafCount < 2
        ? width / 2
        : sideMargin + (span * (range.first + range.last)) / (2 * (leafCount - 1)),
    ]),
  )
}

export function createInitialLineagePositions(
  nodes: readonly LineageGraphNode[],
  dimensions: GraphDimensions,
  savedPositions: ReadonlyMap<string, GraphPosition> = new Map(),
  edges: readonly LineageGraphEdge[] = [],
): Map<string, GraphPosition> {
  const positions = new Map<string, GraphPosition>()
  const unsavedNodes = nodes.filter((node) => !savedPositions.has(node.key))
  const yTargets = createChronologicalYTargets(nodes, dimensions.height)
  const xTargets = createLineageXTargets(nodes, edges, dimensions.width)
  const goldenAngle = Math.PI * (3 - Math.sqrt(5))

  nodes.forEach((node) => {
    const savedPosition = savedPositions.get(node.key)
    if (savedPosition !== undefined) positions.set(node.key, savedPosition)
  })

  const orderedUnsavedNodes = [...unsavedNodes].sort(sortByTimeAndId)
  orderedUnsavedNodes.forEach((node, index) => {
    const angle = index * goldenAngle
    positions.set(node.key, {
      x: (xTargets.get(node.key) ?? dimensions.width / 2) + Math.cos(angle) * 18,
      y: yTargets.get(node.key) ?? dimensions.height / 2,
    })
  })

  return positions
}

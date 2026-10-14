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
    if (imprint.parentId !== null && imprintKeys.has(`imprint:${imprint.parentId}`)) {
      edges.push({ from: `imprint:${imprint.parentId}`, to: `imprint:${imprint.id}` })
    } else if (imprint.parentId === null && codeKeys.has(`code:${imprint.codeId}`)) {
      edges.push({ from: `code:${imprint.codeId}`, to: `imprint:${imprint.id}` })
    }
  }

  return { nodes, edges }
}

export function graphDimensions(nodeCount: number): GraphDimensions {
  const side = Math.max(680, Math.ceil(Math.sqrt(Math.max(nodeCount, 1))) * 190)
  return { width: side + 320, height: side + 120 }
}

export function createInitialLineagePositions(
  nodes: readonly LineageGraphNode[],
  dimensions: GraphDimensions,
  savedPositions: ReadonlyMap<string, GraphPosition> = new Map(),
): Map<string, GraphPosition> {
  const positions = new Map<string, GraphPosition>()
  const unsavedNodes = nodes.filter((node) => !savedPositions.has(node.key))
  const radius = Math.min(dimensions.width, dimensions.height) * 0.34
  const centerX = dimensions.width / 2
  const centerY = dimensions.height / 2
  const goldenAngle = Math.PI * (3 - Math.sqrt(5))

  nodes.forEach((node) => {
    const savedPosition = savedPositions.get(node.key)
    if (savedPosition !== undefined) positions.set(node.key, savedPosition)
  })

  const orderedUnsavedNodes = [...unsavedNodes].sort(sortByTimeAndId)
  orderedUnsavedNodes.forEach((node, index) => {
    const distance = radius * Math.sqrt((index + 0.5) / Math.max(unsavedNodes.length, 1))
    const angle = index * goldenAngle
    positions.set(node.key, {
      x: centerX + Math.cos(angle) * distance,
      y: centerY + Math.sin(angle) * distance,
    })
  })

  return positions
}

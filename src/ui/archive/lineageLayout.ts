import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type Simulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from 'd3-force'
import type { GraphDimensions, GraphPosition, LineageGraph, LineageGraphNode } from './lineageGraph'
import {
  createChronologicalYTargets,
  createInitialLineagePositions,
  createLineageXTargets,
} from './lineageGraph'

export type LineageSimulationNode = LineageGraphNode & SimulationNodeDatum
type LineageSimulationLink = SimulationLinkDatum<LineageSimulationNode>

export type LineageLayoutSimulation = {
  nodes: LineageSimulationNode[]
  simulation: Simulation<LineageSimulationNode, LineageSimulationLink>
}

export function createLineageLayoutSimulation(
  graph: LineageGraph,
  dimensions: GraphDimensions,
  savedPositions: ReadonlyMap<string, GraphPosition>,
): LineageLayoutSimulation {
  const initialPositions = createInitialLineagePositions(
    graph.nodes,
    dimensions,
    savedPositions,
    graph.edges,
  )
  const nodes: LineageSimulationNode[] = graph.nodes.map((node) => {
    const position = initialPositions.get(node.key)
    if (position === undefined) throw new Error(`No initial graph position for ${node.key}`)
    return {
      ...node,
      x: position.x,
      y: position.y,
    }
  })
  const links: LineageSimulationLink[] = graph.edges.map((edge) => ({
    source: edge.from,
    target: edge.to,
  }))
  const yTargets = createChronologicalYTargets(graph.nodes, dimensions.height)
  const xTargets = createLineageXTargets(graph.nodes, graph.edges, dimensions.width)
  const simulation = forceSimulation<LineageSimulationNode>(nodes)
    .force(
      'link',
      forceLink<LineageSimulationNode, LineageSimulationLink>(links)
        .id((node) => node.key)
        .distance(188)
        .strength(0.85),
    )
    .force('charge', forceManyBody<LineageSimulationNode>().strength(-460).distanceMax(540))
    .force(
      'collision',
      forceCollide<LineageSimulationNode>()
        .radius((node) => (node.role === 'seed' ? 70 : node.kind === 'imprint' ? 56 : 52))
        .strength(0.9)
        .iterations(2),
    )
    .force(
      'center',
      forceCenter<LineageSimulationNode>(dimensions.width / 2, dimensions.height / 2),
    )
    .alpha(0.95)
    .alphaMin(0.015)
    .alphaDecay(0.048)
    .velocityDecay(0.32)

  return { nodes, simulation }
}

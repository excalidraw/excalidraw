// Mermaid Layout Engine - Calculate positions for nodes

import type { MermaidGraph, MermaidNode } from "./mermaidParser";

export interface LayoutNode extends MermaidNode {
  x: number;
  y: number;
  width: number;
  height: number;
}

const NODE_WIDTH = 180;
const NODE_HEIGHT = 80;
const HORIZONTAL_SPACING = 200;
const VERTICAL_SPACING = 150;

/**
 * Calculate layout positions for nodes based on graph direction
 */
export function calculateLayout(graph: MermaidGraph): LayoutNode[] {
  const { direction, nodes, edges } = graph;

  // Build adjacency list for topological ordering
  const adjacency = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  nodes.forEach((node) => {
    adjacency.set(node.id, []);
    inDegree.set(node.id, 0);
  });

  edges.forEach((edge) => {
    adjacency.get(edge.from)?.push(edge.to);
    inDegree.set(edge.to, (inDegree.get(edge.to) || 0) + 1);
  });

  // Topological sort to determine levels
  const levels: string[][] = [];
  const queue: string[] = [];

  // Start with nodes that have no incoming edges
  nodes.forEach((node) => {
    if (inDegree.get(node.id) === 0) {
      queue.push(node.id);
    }
  });

  while (queue.length > 0) {
    const levelNodes: string[] = [];
    const levelSize = queue.length;

    for (let i = 0; i < levelSize; i++) {
      const nodeId = queue.shift()!;
      levelNodes.push(nodeId);

      adjacency.get(nodeId)?.forEach((neighbor) => {
        const degree = inDegree.get(neighbor)! - 1;
        inDegree.set(neighbor, degree);
        if (degree === 0) {
          queue.push(neighbor);
        }
      });
    }

    if (levelNodes.length > 0) {
      levels.push(levelNodes);
    }
  }

  // Handle nodes not in any level (cycles or disconnected)
  const processedNodes = new Set(levels.flat());
  const remainingNodes = nodes
    .filter((n) => !processedNodes.has(n.id))
    .map((n) => n.id);
  if (remainingNodes.length > 0) {
    levels.push(remainingNodes);
  }

  // Calculate positions based on direction
  const layoutNodes: LayoutNode[] = [];

  if (direction === "TD" || direction === "BT") {
    // Top-Down or Bottom-Top layout
    levels.forEach((level, levelIndex) => {
      const y =
        direction === "TD"
          ? levelIndex * (NODE_HEIGHT + VERTICAL_SPACING)
          : (levels.length - 1 - levelIndex) * (NODE_HEIGHT + VERTICAL_SPACING);

      level.forEach((nodeId, nodeIndex) => {
        const node = nodes.find((n) => n.id === nodeId)!;
        const totalWidth = level.length * NODE_WIDTH + (level.length - 1) * HORIZONTAL_SPACING;
        const startX = -totalWidth / 2;
        const x = startX + nodeIndex * (NODE_WIDTH + HORIZONTAL_SPACING);

        layoutNodes.push({
          ...node,
          x,
          y,
          width: NODE_WIDTH,
          height: NODE_HEIGHT,
        });
      });
    });
  } else {
    // Left-Right or Right-Left layout
    levels.forEach((level, levelIndex) => {
      const x =
        direction === "LR"
          ? levelIndex * (NODE_WIDTH + HORIZONTAL_SPACING)
          : (levels.length - 1 - levelIndex) * (NODE_WIDTH + HORIZONTAL_SPACING);

      level.forEach((nodeId, nodeIndex) => {
        const node = nodes.find((n) => n.id === nodeId)!;
        const totalHeight = level.length * NODE_HEIGHT + (level.length - 1) * VERTICAL_SPACING;
        const startY = -totalHeight / 2;
        const y = startY + nodeIndex * (NODE_HEIGHT + VERTICAL_SPACING);

        layoutNodes.push({
          ...node,
          x,
          y,
          width: NODE_WIDTH,
          height: NODE_HEIGHT,
        });
      });
    });
  }

  return layoutNodes;
}

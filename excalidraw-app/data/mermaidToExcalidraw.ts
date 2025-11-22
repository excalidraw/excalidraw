// Convert Mermaid diagrams to Excalidraw elements

import {
  newElement,
  newTextElement,
  newArrowElement,
  syncInvalidIndices,
} from "@excalidraw/element";
import type { ExcalidrawElement } from "@excalidraw/element/types";
import { pointFrom } from "@excalidraw/math";

import { parseMermaidFlowchart } from "./mermaidParser";
import { calculateLayout } from "./mermaidLayout";
import type { LayoutNode } from "./mermaidLayout";

/**
 * Convert Mermaid code to Excalidraw elements
 */
export function mermaidToExcalidraw(
  mermaidCode: string,
  startX: number = 100,
  startY: number = 100,
): ExcalidrawElement[] {
  try {
    // Parse Mermaid code
    const graph = parseMermaidFlowchart(mermaidCode);

    // Calculate layout
    const layoutNodes = calculateLayout(graph);

    // Create node map for edge connections
    const nodeMap = new Map<string, LayoutNode>();
    layoutNodes.forEach((node) => nodeMap.set(node.id, node));

    const elements: ExcalidrawElement[] = [];

    // Create rectangle elements for nodes
    layoutNodes.forEach((node) => {
      const x = startX + node.x;
      const y = startY + node.y;

      // Create rectangle
      const rect = newElement({
        type: "rectangle",
        x,
        y,
        width: node.width,
        height: node.height,
        strokeColor: "#1971c2",
        backgroundColor: "#a5d8ff",
        fillStyle: "solid",
        strokeWidth: 2,
        roughness: 1,
        roundness:
          node.shape === "rounded"
            ? { type: 3, value: 16 }
            : node.shape === "circle"
              ? { type: 3, value: node.width / 2 }
              : null,
      });

      elements.push(rect);

      // Create text element for label
      const text = newTextElement({
        x: x + node.width / 2,
        y: y + node.height / 2,
        text: node.label,
        fontSize: 16,
        fontFamily: 1,
        textAlign: "center",
        verticalAlign: "middle",
        containerId: rect.id,
        originalText: node.label,
      });

      elements.push(text);
    });

    // Create arrow elements for edges
    graph.edges.forEach((edge) => {
      const fromNode = nodeMap.get(edge.from);
      const toNode = nodeMap.get(edge.to);

      if (!fromNode || !toNode) {
        return;
      }

      // Calculate arrow start and end points
      const arrowStartX = startX + fromNode.x + fromNode.width / 2;
      const arrowStartY = startY + fromNode.y + fromNode.height;
      const arrowEndX = startX + toNode.x + toNode.width / 2;
      const arrowEndY = startY + toNode.y;

      // Create arrow
      const arrow = newArrowElement({
        type: "arrow",
        x: Math.min(arrowStartX, arrowEndX),
        y: Math.min(arrowStartY, arrowEndY),
        width: Math.abs(arrowEndX - arrowStartX),
        height: Math.abs(arrowEndY - arrowStartY),
        strokeColor: "#1971c2",
        strokeWidth: 2,
        strokeStyle: edge.type === "dashed" ? "dashed" : "solid",
        roughness: 1,
        startArrowhead: null,
        endArrowhead: "arrow",
        points: [
          pointFrom(0, 0),
          pointFrom(
            arrowEndX - Math.min(arrowStartX, arrowEndX),
            arrowEndY - Math.min(arrowStartY, arrowEndY),
          ),
        ],
      });

      elements.push(arrow);

      // Add edge label if present
      if (edge.label) {
        const labelX = (arrowStartX + arrowEndX) / 2;
        const labelY = (arrowStartY + arrowEndY) / 2;

        const labelText = newTextElement({
          x: labelX,
          y: labelY,
          text: edge.label,
          fontSize: 14,
          fontFamily: 1,
          textAlign: "center",
          verticalAlign: "middle",
        });

        elements.push(labelText);
      }
    });

    // Sync fractional indices to ensure proper z-ordering
    return syncInvalidIndices(elements);
  } catch (error) {
    console.error("Failed to convert Mermaid to Excalidraw:", error);
    throw new Error("Unable to parse Mermaid diagram");
  }
}

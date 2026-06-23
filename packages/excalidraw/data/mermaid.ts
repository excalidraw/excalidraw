import { isArrowElement, isTextElement } from "@excalidraw/element";

import type {
  ExcalidrawElement,
  ExcalidrawTextElement,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";

export class MermaidExportError extends Error {}

type MermaidNodeShape = "rectangle" | "diamond" | "circle";

type MermaidNode = {
  id: string;
  mermaidId: string;
  label: string;
  shape: MermaidNodeShape;
  x: number;
  y: number;
};

type MermaidEdge = {
  from: string;
  to: string;
  label: string | null;
  sortX: number;
  sortY: number;
};

const sanitizeLabel = (label: string) =>
  label
    .replace(/\r?\n/g, " ")
    .replace(/\s+/g, " ")
    .replace(/"/g, "'")
    .replace(/\|/g, "/")
    .trim();

const escapeNodeLabel = (label: string) => `"${sanitizeLabel(label)}"`;

const formatNode = (node: MermaidNode) => {
  const label = escapeNodeLabel(node.label);

  switch (node.shape) {
    case "rectangle":
      return `${node.mermaidId}[${label}]`;
    case "diamond":
      return `${node.mermaidId}{${label}}`;
    case "circle":
      return `${node.mermaidId}((${label}))`;
  }
};

const getNodeShape = (
  element: NonDeletedExcalidrawElement,
): MermaidNodeShape | null => {
  switch (element.type) {
    case "rectangle":
      return "rectangle";
    case "diamond":
      return "diamond";
    case "ellipse":
      return "circle";
    case "text":
      return element.containerId ? null : "rectangle";
    default:
      return null;
  }
};

const getBoundTextByContainerId = (
  containerId: string,
  elements: readonly NonDeletedExcalidrawElement[],
): ExcalidrawTextElement | null =>
  elements.find(
    (element): element is ExcalidrawTextElement =>
      isTextElement(element) && element.containerId === containerId,
  ) || null;

const getNodeLabel = (
  element: NonDeletedExcalidrawElement,
  elements: readonly NonDeletedExcalidrawElement[],
) => {
  if (isTextElement(element)) {
    return sanitizeLabel(element.text);
  }

  const boundText = getBoundTextByContainerId(element.id, elements);
  return sanitizeLabel(boundText?.text || "");
};

const getMermaidDirection = (edges: MermaidEdge[]) => {
  if (!edges.length) {
    return "TD";
  }

  let horizontalEdges = 0;
  for (const edge of edges) {
    if (Math.abs(edge.sortX) > Math.abs(edge.sortY)) {
      horizontalEdges += 1;
    }
  }

  return horizontalEdges >= Math.ceil(edges.length / 2) ? "LR" : "TD";
};

const getExportableElements = (
  elements: readonly ExcalidrawElement[],
): readonly NonDeletedExcalidrawElement[] =>
  elements.filter((element): element is NonDeletedExcalidrawElement => {
    return !element.isDeleted;
  });

const getUnsupportedElements = (
  elements: readonly NonDeletedExcalidrawElement[],
  elementsMap: Map<string, NonDeletedExcalidrawElement>,
) =>
  elements.filter((element) => {
    if (isArrowElement(element)) {
      return false;
    }

    if (isTextElement(element) && element.containerId) {
      const container = elementsMap.get(element.containerId);
      return !container
        ? true
        : !isArrowElement(container) && getNodeShape(container) === null;
    }

    return getNodeShape(element) === null;
  });

export const serializeExcalidrawToMermaid = (
  elements: readonly ExcalidrawElement[],
) => {
  const exportableElements = getExportableElements(elements);
  if (!exportableElements.length) {
    throw new MermaidExportError("Cannot export empty canvas.");
  }

  const elementsMap = new Map<string, NonDeletedExcalidrawElement>(
    exportableElements.map((element) => [element.id, element]),
  );
  const unsupportedElements = getUnsupportedElements(
    exportableElements,
    elementsMap,
  );

  if (unsupportedElements.length) {
    throw new MermaidExportError(
      "Only rectangles, diamonds, ellipses, text, and bound arrows can be exported to Mermaid.",
    );
  }

  const nodes = exportableElements
    .map((element, index) => {
      const shape = getNodeShape(element);
      if (!shape) {
        return null;
      }

      return {
        id: element.id,
        mermaidId: `N${index + 1}`,
        label: getNodeLabel(element, exportableElements) || `Node ${index + 1}`,
        shape,
        x: element.x + element.width / 2,
        y: element.y + element.height / 2,
      } as MermaidNode;
    })
    .filter((node): node is MermaidNode => !!node)
    .sort((a, b) => a.y - b.y || a.x - b.x);

  const nodesById = new Map(
    nodes.map((node, index) => [
      node.id,
      {
        ...node,
        mermaidId: `N${index + 1}`,
      },
    ]),
  );

  const edges = exportableElements
    .filter(isArrowElement)
    .map((arrow) => {
      const from = arrow.startBinding?.elementId;
      const to = arrow.endBinding?.elementId;

      if (!from || !to) {
        throw new MermaidExportError(
          "Only arrows bound to two nodes can be exported to Mermaid.",
        );
      }

      const fromNode = nodesById.get(from);
      const toNode = nodesById.get(to);

      if (!fromNode || !toNode) {
        throw new MermaidExportError(
          "Only arrows connected to supported nodes can be exported to Mermaid.",
        );
      }

      const boundText = getBoundTextByContainerId(arrow.id, exportableElements);

      return {
        from,
        to,
        label: boundText?.text ? sanitizeLabel(boundText.text) : null,
        sortX: toNode.x - fromNode.x,
        sortY: toNode.y - fromNode.y,
      } as MermaidEdge;
    })
    .sort((a, b) => a.sortY - b.sortY || a.sortX - b.sortX);

  const direction = getMermaidDirection(edges);
  const lines = [`flowchart ${direction}`];

  for (const node of nodesById.values()) {
    lines.push(`  ${formatNode(node)}`);
  }

  for (const edge of edges) {
    const fromNode = nodesById.get(edge.from)!;
    const toNode = nodesById.get(edge.to)!;
    const label = edge.label ? `|${edge.label}|` : "";
    lines.push(`  ${fromNode.mermaidId} -->${label} ${toNode.mermaidId}`);
  }

  return lines.join("\n");
};

export const canSerializeExcalidrawToMermaid = (
  elements: readonly ExcalidrawElement[],
) => {
  try {
    serializeExcalidrawToMermaid(elements);
    return true;
  } catch {
    return false;
  }
};

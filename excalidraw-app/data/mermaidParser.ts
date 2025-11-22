// Mermaid Parser - Converts Mermaid syntax to structured data

export interface MermaidNode {
  id: string;
  label: string;
  shape: "rectangle" | "rounded" | "circle" | "diamond";
}

export interface MermaidEdge {
  from: string;
  to: string;
  label?: string;
  type: "solid" | "dashed";
}

export interface MermaidGraph {
  direction: "TD" | "LR" | "BT" | "RL";
  nodes: MermaidNode[];
  edges: MermaidEdge[];
}

/**
 * Parse Mermaid flowchart syntax into structured data
 */
export function parseMermaidFlowchart(mermaidCode: string): MermaidGraph {
  // Normalize the code: add newlines before keywords if missing
  const normalizedCode = mermaidCode
    .replace(/subgraph/g, "\nsubgraph")
    .replace(/end(?!A)/g, "\nend\n") // end keyword but not endA, endB etc
    .replace(/graph\s+(TD|LR|BT|RL)/g, "graph $1\n");

  const lines = normalizedCode
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("%%"));

  const nodes: MermaidNode[] = [];
  const edges: MermaidEdge[] = [];
  let direction: "TD" | "LR" | "BT" | "RL" = "TD";

  // Parse direction
  const directionLine = lines.find((line) =>
    /^graph\s+(TD|LR|BT|RL)/.test(line),
  );
  if (directionLine) {
    const match = directionLine.match(/^graph\s+(TD|LR|BT|RL)/);
    if (match) {
      direction = match[1] as "TD" | "LR" | "BT" | "RL";
    }
  }

  // Parse nodes and edges
  for (const line of lines) {
    if (
      line.startsWith("graph") ||
      line.startsWith("subgraph") ||
      line === "end"
    ) {
      continue;
    }

    // Parse edge: A --> B or A -.-> B or A -->|label| B
    const edgeMatch = line.match(
      /(\w+)\s*(-->|---|-\.-|-.->)\s*(?:\|([^|]+)\|\s*)?(\w+)/,
    );
    if (edgeMatch) {
      const [, from, arrowType, label, to] = edgeMatch;
      edges.push({
        from,
        to,
        label: label?.trim(),
        type: arrowType.includes(".") ? "dashed" : "solid",
      });

      // Ensure nodes exist
      if (!nodes.find((n) => n.id === from)) {
        nodes.push({ id: from, label: from, shape: "rectangle" });
      }
      if (!nodes.find((n) => n.id === to)) {
        nodes.push({ id: to, label: to, shape: "rectangle" });
      }
      continue;
    }

    // Parse node definition: A[Label] or A(Label) or A{Label} or A[/Label/]
    const nodeMatch = line.match(/(\w+)([\[\(\{\/])([^\]\)\}]+)([\]\)\}\/])/);
    if (nodeMatch) {
      const [, id, openBracket, label] = nodeMatch;
      let shape: MermaidNode["shape"] = "rectangle";

      if (openBracket === "(") {
        shape = "rounded";
      } else if (openBracket === "{") {
        shape = "diamond";
      } else if (openBracket === "/") {
        shape = "rounded"; // Treat /.../ as rounded for now
      }

      const existingNode = nodes.find((n) => n.id === id);
      if (existingNode) {
        existingNode.label = label.trim();
        existingNode.shape = shape;
      } else {
        nodes.push({ id, label: label.trim(), shape });
      }
    }
  }

  return { direction, nodes, edges };
}

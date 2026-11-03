import type { MermaidConfig } from "@excalidraw/mermaid-to-excalidraw";

/**
 * How Mermaid diagrams are converted (unless the definition says otherwise,
 * e.g. sets its own `curve` in its front matter or `%%{init}%%`): flowchart
 * edges and state transitions as elbow arrows, which are easier to edit.
 */
export const MERMAID_TO_EXCALIDRAW_CONFIG: MermaidConfig = {
  flowchart: { curve: "step" },
};

/** heuristically checks whether the text may be a mermaid diagram definition */
export const isMaybeMermaidDefinition = (text: string) => {
  const chartTypes = [
    "flowchart",
    "graph",
    "sequenceDiagram",
    "classDiagram",
    "stateDiagram",
    "stateDiagram-v2",
    "erDiagram",
    "journey",
    "gantt",
    "pie",
    "quadrantChart",
    "requirementDiagram",
    "gitGraph",
    "C4Context",
    "mindmap",
    "timeline",
    "zenuml",
    "sankey",
    "xychart",
    "block",
    // `swimlane-beta`, which Pele (unlike Mermaid) renders, as a flowchart
    "swimlane",
  ];

  const re = new RegExp(
    `^(?:%%{.*?}%%[\\s\\n]*)?\\b(?:${chartTypes
      .map((x) => `\\s*${x}(-beta)?`)
      .join("|")})\\b`,
  );

  return re.test(text.trim());
};

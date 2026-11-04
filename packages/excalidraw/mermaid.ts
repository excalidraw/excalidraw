import type { MermaidConfig } from "@excalidraw/mermaid-to-excalidraw";

/**
 * How Mermaid diagrams are converted: flowchart edges as elbow arrows, which
 * are easier to edit (unless the definition sets its own curve in its front
 * matter or `%%{init}%%`).
 */
export const MERMAID_TO_EXCALIDRAW_CONFIG: MermaidConfig = {
  elbow: { flowchart: true },
};

// What may precede a definition's diagram type: whitespace, front matter,
// directives (`%%{...}%%`, possibly over several lines) and comment lines.
// A directive doesn't run past the next `%%{`, so an unclosed one is searched
// for its end only up to there, not to the end of the text, every time (which
// is quadratic in the number of unclosed directives).
const MERMAID_PREAMBLE =
  /^(?:\s|---[ \t]*\r?\n[\s\S]*?\r?\n[ \t]*---[ \t]*(?=\r?\n|$)|%%\{(?:(?!%%\{)[\s\S])*?\}%%|%%[^\n]*)*/;

const MERMAID_DIAGRAM_TYPES = [
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

const MERMAID_DIAGRAM_TYPE = new RegExp(
  `^(?:${MERMAID_DIAGRAM_TYPES.join("|")})(-beta)?\\b`,
);

/** heuristically checks whether the text may be a mermaid diagram definition */
export const isMaybeMermaidDefinition = (text: string) =>
  MERMAID_DIAGRAM_TYPE.test(text.replace(MERMAID_PREAMBLE, ""));

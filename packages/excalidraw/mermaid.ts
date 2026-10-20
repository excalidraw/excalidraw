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
  ];

  const re = new RegExp(
    `^(?:%%{.*?}%%[\\s\\n]*)?\\b(?:${chartTypes
      .map((x) => `\\s*${x}(-beta)?`)
      .join("|")})\\b`,
  );

  return re.test(text.trim());
};

/**
 * Mermaid supports `<br>`-family tags for line breaks in node labels, but the
 * skeletons produced by `@excalidraw/mermaid-to-excalidraw` keep them verbatim,
 * so the bound text elements end up displaying the literal tag. Replace them
 * with real newlines so the labels wrap like in the official renderer.
 */
export const replaceMermaidLineBreaks = (text: string) =>
  text.replace(/<br\s*\/?>/gi, "\n");

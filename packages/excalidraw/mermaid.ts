/**
 * Replaces HTML <br> tags (and variants like <br/>, <br />) with newlines.
 * Mermaid uses <br> tags for line breaks in node labels, but Excalidraw
 * expects actual newline characters in text content.
 */
const replaceBrTagsWithNewlines = (text: string): string => {
  return text.replace(/<br\s*\/?>/gi, "\n");
};

/**
 * Sanitizes text fields in Mermaid-to-Excalidraw skeleton elements by
 * converting HTML <br> tags to newline characters. This handles the case
 * where Mermaid diagrams use <br> for multi-line labels (e.g.
 * `A["Line 1<br>Line 2"]`), which the mermaid-to-excalidraw parser passes
 * through as literal "<br>" text.
 */
export const sanitizeMermaidElementText = <
  T extends { text?: string; label?: { text: string } },
>(
  elements: readonly T[],
): T[] => {
  return elements.map((element) => {
    const result = { ...element };

    // Sanitize direct text property (text elements)
    if (typeof result.text === "string") {
      result.text = replaceBrTagsWithNewlines(result.text) as T["text"];
    }

    // Sanitize label.text property (containers: rectangle, ellipse, diamond, arrow)
    if (result.label && typeof result.label.text === "string") {
      result.label = {
        ...result.label,
        text: replaceBrTagsWithNewlines(result.label.text),
      };
    }

    return result;
  });
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
  ];

  const re = new RegExp(
    `^(?:%%{.*?}%%[\\s\\n]*)?\\b(?:${chartTypes
      .map((x) => `\\s*${x}(-beta)?`)
      .join("|")})\\b`,
  );

  return re.test(text.trim());
};

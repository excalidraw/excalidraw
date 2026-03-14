/**
 * Replaces HTML line-break tags (`<br>`, `<br/>`, `<br />`) with newlines.
 * Mermaid supports `<br>` inside node labels for multi-line text, but the
 * mermaid-to-excalidraw converter may preserve them as literal strings in the
 * output element text.  This helper normalises them so Excalidraw renders
 * proper line breaks instead of showing the raw tag.
 */
const stripHtmlBreaks = (text: string) =>
  text.replace(/<br\s*\/?>/gi, "\n");

/**
 * Post-processes skeleton elements returned by `parseMermaidToExcalidraw` so
 * that HTML `<br>` tags embedded in text properties are converted to newlines.
 */
export const sanitizeMermaidElementText = <
  T extends { text?: string; label?: { text: string } },
>(
  elements: T[],
): T[] =>
  elements.map((el) => {
    let changed = false;
    const patch: Record<string, unknown> = {};

    if (typeof el.text === "string" && /<br\s*\/?>/i.test(el.text)) {
      patch.text = stripHtmlBreaks(el.text);
      changed = true;
    }

    if (
      el.label &&
      typeof el.label.text === "string" &&
      /<br\s*\/?>/i.test(el.label.text)
    ) {
      patch.label = { ...el.label, text: stripHtmlBreaks(el.label.text) };
      changed = true;
    }

    return changed ? { ...el, ...patch } : el;
  });

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

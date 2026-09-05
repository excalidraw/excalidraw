import type { ExcalidrawElementSkeleton } from "@excalidraw/element";

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
 * mermaid renders `<br>` (and its `<br/>` / `<br />` variants) inside labels as
 * a line break, but `@excalidraw/mermaid-to-excalidraw` passes the label text
 * through verbatim, so the tag would end up drawn as literal text on canvas.
 */
export const normalizeMermaidLineBreaks = (
  elements: readonly ExcalidrawElementSkeleton[],
): ExcalidrawElementSkeleton[] => {
  const replaceBreaks = (text: string) => text.replace(/<br\s*\/?>/gi, "\n");

  return elements.map((element) => {
    const { text, label } = element as {
      text?: string;
      label?: { text?: string };
    };

    const nextText = text != null ? replaceBreaks(text) : text;
    const nextLabelText =
      label?.text != null ? replaceBreaks(label.text) : label?.text;

    if (nextText === text && nextLabelText === label?.text) {
      return element;
    }

    return {
      ...element,
      ...(nextText !== text && { text: nextText }),
      ...(nextLabelText !== label?.text && {
        label: { ...label, text: nextLabelText },
      }),
    } as ExcalidrawElementSkeleton;
  });
};

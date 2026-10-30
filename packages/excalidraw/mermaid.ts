export type MermaidContentLine = {
  index: number;
  text: string;
};

const MERMAID_COMMENT_LINE = /^\s*%%(?!\{)/;
const MERMAID_DIRECTIVE_START = /^\s*%%\{/;
const MERMAID_DIRECTIVE_END = /\}%%/;
const MERMAID_DIRECTIVE_END_LENGTH = "}%%".length;

export const getMermaidContentLines = (
  sourceText: string,
): MermaidContentLine[] => {
  const lines = sourceText.replace(/^\uFEFF/, "").split(/\r?\n/);
  const contentLines: MermaidContentLine[] = [];
  const isBlankOrComment = (line: string) =>
    !line.trim() || MERMAID_COMMENT_LINE.test(line);

  let index = 0;
  while (index < lines.length && isBlankOrComment(lines[index])) {
    index++;
  }
  if (lines[index]?.trim() === "---") {
    const end = lines.findIndex(
      (line, lineIndex) => lineIndex > index && line.trim() === "---",
    );
    if (end !== -1) {
      index = end + 1;
    }
  }

  for (; index < lines.length; index++) {
    const line = lines[index];
    if (!contentLines.length && !line.trim()) {
      continue;
    }
    if (MERMAID_COMMENT_LINE.test(line)) {
      continue;
    }
    if (MERMAID_DIRECTIVE_START.test(line)) {
      let endIndex = index;
      let directiveLine = line;
      while (
        !MERMAID_DIRECTIVE_END.test(directiveLine) &&
        endIndex < lines.length - 1
      ) {
        endIndex++;
        directiveLine = lines[endIndex];
      }
      const end = directiveLine.search(MERMAID_DIRECTIVE_END);
      if (end !== -1) {
        const rest = directiveLine.slice(end + MERMAID_DIRECTIVE_END_LENGTH);
        if (rest.trim() && !MERMAID_COMMENT_LINE.test(rest)) {
          contentLines.push({ index: endIndex, text: rest });
        }
      }
      index = endIndex;
      continue;
    }
    contentLines.push({ index, text: line });
  }

  return contentLines;
};

const MERMAID_CHART_TYPES = [
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

const MERMAID_DEFINITION_START = new RegExp(
  `^(?:${MERMAID_CHART_TYPES.map((chartType) => `${chartType}(?:-beta)?`).join(
    "|",
  )})\\b`,
);

/** heuristically checks whether the text may be a mermaid diagram definition */
export const isMaybeMermaidDefinition = (text: string) => {
  const header = getMermaidContentLines(text)[0];
  return !!header && MERMAID_DEFINITION_START.test(header.text.trim());
};

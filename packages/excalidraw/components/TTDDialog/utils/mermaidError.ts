const MERMAID_SYNTAX_ERROR_LINE = /(?:Parse|Lexical) error on line (\d+)[.:]/i;
const MERMAID_INACTIVE_PARTICIPANT_ERROR =
  /Trying to inactivate an inactive participant \((.+)\)/i;
const MERMAID_CARET_LINE = /^\s*-+\^\s*$/;
// Mermaid: "No diagram type detected matching given configuration for text:
// ...", Pele: "No diagram type detected for the given text."
const MERMAID_UNKNOWN_DIAGRAM_ERROR = /No diagram type detected/i;
// Chrome, Firefox and Safari messages respectively
const MODULE_LOAD_ERROR =
  /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed/i;

/** a lazy-loaded chunk (e.g. one of Pele's diagram chunks) failed to load */
export const isModuleLoadError = (error: unknown) =>
  error instanceof Error && MODULE_LOAD_ERROR.test(error.message);

export const isMermaidParseSyntaxError = (message: string) =>
  MERMAID_SYNTAX_ERROR_LINE.test(message);

/** the definition doesn't start with a (known) diagram type */
export const isMermaidUnknownDiagramError = (message: string) =>
  MERMAID_UNKNOWN_DIAGRAM_ERROR.test(message);

export const isMermaidAutoFixableError = (message: string) =>
  isMermaidParseSyntaxError(message) ||
  MERMAID_INACTIVE_PARTICIPANT_ERROR.test(message) ||
  isMermaidUnknownDiagramError(message);

export type MermaidDiagramType =
  | "flowchart"
  | "sequence"
  | "class"
  | "state"
  | "er";

const MERMAID_DIAGRAM_TYPES: Record<string, MermaidDiagramType> = {
  flowchart: "flowchart",
  graph: "flowchart",
  sequencediagram: "sequence",
  classdiagram: "class",
  "classdiagram-v2": "class",
  statediagram: "state",
  "statediagram-v2": "state",
  erdiagram: "er",
};

/**
 * Index of the line that declares the diagram type: the first one that isn't
 * empty, a comment, a directive (`%%{...}%%`) or front matter (`---` block).
 */
export const getMermaidHeaderLineIndex = (sourceText: string) => {
  const lines = sourceText.split(/\r?\n/);
  let index = 0;
  const isSkipped = (line: string) => !line.trim() || /^\s*%%/.test(line);
  while (index < lines.length && isSkipped(lines[index])) {
    index++;
  }
  if (lines[index]?.trim() === "---") {
    const end = lines.findIndex(
      (line, lineIndex) => lineIndex > index && line.trim() === "---",
    );
    if (end !== -1) {
      index = end + 1;
      while (index < lines.length && isSkipped(lines[index])) {
        index++;
      }
    }
  }
  return index < lines.length ? index : null;
};

/** The diagram type the definition declares (of those Excalidraw converts). */
export const getMermaidDiagramType = (
  sourceText: string,
): MermaidDiagramType | null => {
  const headerIndex = getMermaidHeaderLineIndex(sourceText);
  if (headerIndex === null) {
    return null;
  }
  const keyword = sourceText
    .split(/\r?\n/)
    [headerIndex].trim()
    .split(/\s/)[0]
    .toLowerCase();
  return MERMAID_DIAGRAM_TYPES[keyword] ?? null;
};

export const isMermaidCaretLine = (line: string) =>
  MERMAID_CARET_LINE.test(line);

export const getMermaidInactiveParticipant = (
  message: string,
): string | null => {
  const match = message.match(MERMAID_INACTIVE_PARTICIPANT_ERROR);
  if (!match?.[1]) {
    return null;
  }
  return match[1].trim();
};

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const getInactiveParticipantLineNumber = (
  message: string,
  sourceText: string,
): number | null => {
  const participant = getMermaidInactiveParticipant(message);
  if (!participant) {
    return null;
  }

  const deactivatePattern = new RegExp(
    `^\\s*deactivate\\s+${escapeRegExp(participant)}(?:\\s+%%.*)?\\s*$`,
  );
  const lines = sourceText.split(/\r?\n/);
  for (let index = lines.length - 1; index >= 0; index--) {
    if (deactivatePattern.test(lines[index])) {
      return index + 1;
    }
  }
  return null;
};

export const getMermaidErrorLineNumber = (
  message: string,
  sourceText?: string,
): number | null => {
  const match = message.match(MERMAID_SYNTAX_ERROR_LINE);
  if (!match) {
    if (!sourceText) {
      return null;
    }
    if (isMermaidUnknownDiagramError(message)) {
      const headerIndex = getMermaidHeaderLineIndex(sourceText);
      return headerIndex === null ? null : headerIndex + 1;
    }
    return getInactiveParticipantLineNumber(message, sourceText);
  }
  const line = Number.parseInt(match[1], 10);
  return sourceText ? getMermaidSourceLineNumber(line, sourceText) : line;
};

/**
 * The (0-based) indexes of the source lines the lines Mermaid (and Pele)
 * number errors by start at. They parse a definition without its front
 * matter, directives, comment lines and leading blank lines, and in
 * flowcharts and ER diagrams, a line ending with a comment runs on into the
 * next one.
 */
const getParsedLineStarts = (sourceText: string) => {
  const lines = sourceText.split(/\r?\n/);
  const type = getMermaidDiagramType(sourceText);
  const runsOnAfterComments = type === "flowchart" || type === "er";
  const starts: number[] = [];
  let index = 0;
  if (lines[0]?.trim() === "---") {
    const end = lines.findIndex((line, i) => i > 0 && line.trim() === "---");
    if (end !== -1) {
      index = end + 1;
    }
  }
  let runsOn = false;
  for (; index < lines.length; index++) {
    const line = lines[index];
    // a directive, possibly over several lines
    if (/^\s*%%\{/.test(line)) {
      while (index < lines.length - 1 && !/\}%%/.test(lines[index])) {
        index++;
      }
      continue;
    }
    if (/^\s*%%(?!\{)./.test(line) || (!starts.length && !line.trim())) {
      continue;
    }
    if (!runsOn) {
      starts.push(index);
    }
    runsOn = runsOnAfterComments && /\S.*%%/.test(line);
  }
  return starts;
};

/**
 * The line of the source an error Mermaid (or Pele) reports on `line` is on:
 * errors past its end (e.g. a missing `end`) are on its last non-empty line.
 */
export const getMermaidSourceLineNumber = (
  line: number,
  sourceText: string,
) => {
  const starts = getParsedLineStarts(sourceText);
  if (line >= 1 && line <= starts.length) {
    let index = starts[line - 1];
    // e.g. the empty line Mermaid reports an error at the end on
    while (index > 0 && !sourceText.split(/\r?\n/)[index].trim()) {
      index--;
    }
    return index + 1;
  }
  const lines = sourceText.split(/\r?\n/);
  let lastLine = lines.length;
  while (lastLine > 1 && !lines[lastLine - 1].trim()) {
    lastLine--;
  }
  return lastLine;
};

const countMatches = (text: string, re: RegExp) =>
  (text.match(re) || []).length;

// Blocks closed by `end`
const MERMAID_END_BLOCK_OPENERS: Partial<Record<MermaidDiagramType, RegExp>> = {
  flowchart: /^\s*subgraph\b/,
  sequence: /^\s*(?:loop|alt|opt|par|par_over|critical|break|rect|box)\b/,
};

/** A line closing a block that `end`s */
export const MERMAID_END_LINE = /^\s*end\s*$/;

/** What's missing when a block opened by a line ending with `{` isn't closed */
const MERMAID_UNCLOSED_BRACE_BLOCKS: Partial<
  Record<MermaidDiagramType, string>
> = {
  class: "A class body is missing its closing `}`.",
  state: "A composite state is missing its closing `}`.",
  er: "An entity's attributes are missing their closing `}`.",
};

export const getMermaidEndBlockOpener = (type: MermaidDiagramType | null) =>
  type ? MERMAID_END_BLOCK_OPENERS[type] ?? null : null;

// How the definitions of the diagram types Excalidraw converts start
const KNOWN_DIAGRAM_TYPES =
  "`flowchart TD`, `sequenceDiagram`, `classDiagram`, `stateDiagram-v2` or `erDiagram`";

export const getMermaidSyntaxErrorGuidance = (
  message: string,
  sourceText?: string,
): { summary: string; likelyCauses: string[] } | null => {
  if (isMermaidUnknownDiagramError(message)) {
    return {
      summary: "Unknown diagram type.",
      likelyCauses: [
        `The first line must name the diagram type, e.g. ${KNOWN_DIAGRAM_TYPES}.`,
      ],
    };
  }

  if (!isMermaidParseSyntaxError(message)) {
    return null;
  }

  const errorLine = getMermaidErrorLineNumber(message, sourceText);
  const summary = errorLine
    ? `Syntax error near line ${errorLine}.`
    : "Syntax error in Mermaid diagram.";

  const likelyCauses: string[] = [];
  const type = sourceText ? getMermaidDiagramType(sourceText) : null;

  if (sourceText) {
    const openBrackets = countMatches(sourceText, /\[/g);
    const closeBrackets = countMatches(sourceText, /\]/g);
    if (openBrackets !== closeBrackets) {
      likelyCauses.push(
        type === "flowchart"
          ? "Unbalanced square brackets in a node label."
          : "Unbalanced square brackets.",
      );
    }

    const openParens = countMatches(sourceText, /\(/g);
    const closeParens = countMatches(sourceText, /\)/g);
    if (openParens !== closeParens) {
      likelyCauses.push(
        type === "flowchart"
          ? "Unbalanced parentheses in a node shape."
          : "Unbalanced parentheses.",
      );
    }

    const openBraces = countMatches(sourceText, /\{/g);
    const closeBraces = countMatches(sourceText, /\}/g);
    if (openBraces !== closeBraces) {
      const unclosedBlock = type && MERMAID_UNCLOSED_BRACE_BLOCKS[type];
      likelyCauses.push(
        type === "flowchart"
          ? "Unbalanced braces in a decision node."
          : unclosedBlock && openBraces > closeBraces
          ? unclosedBlock
          : "Unbalanced braces.",
      );
    }

    const opener = getMermaidEndBlockOpener(type);
    if (opener) {
      const lines = sourceText.split(/\r?\n/);
      const openerCount = lines.filter((line) => opener.test(line)).length;
      const endCount = lines.filter((line) =>
        MERMAID_END_LINE.test(line),
      ).length;
      if (openerCount > endCount) {
        likelyCauses.push("A block is missing an `end` statement.");
      }
    }
  }

  const header = sourceText
    ? sourceText.split(/\r?\n/)[getMermaidHeaderLineIndex(sourceText) ?? 0]
    : "";
  // e.g. `sequenceDiagram LR`, `classDiagram direction LR`
  const headerRest = header.match(/^\s*\S+\s+(?!%%)(.+?)\s*$/)?.[1];
  if (
    type === "sequence" &&
    (headerRest || /^\s*direction\b/m.test(sourceText ?? ""))
  ) {
    likelyCauses.push("Sequence diagrams have no `direction`.");
  }
  if (
    headerRest &&
    ((type === "class" && /^(?:direction\s+)?\S+$/.test(headerRest)) ||
      ((type === "state" || type === "er") && /^direction\b/.test(headerRest)))
  ) {
    likelyCauses.push(
      "The diagram's direction goes on the next line, as a `direction` statement: e.g. `direction LR`.",
    );
  }
  if (sourceText && type === "flowchart") {
    const lines = sourceText.split(/\r?\n/);
    const header = lines[getMermaidHeaderLineIndex(sourceText) ?? 0];
    const headerDirection = header.match(
      /^\s*(?:flowchart|graph)\s+(\S+)/,
    )?.[1];
    if (headerDirection && !/^(?:TB|TD|BT|RL|LR)$/.test(headerDirection)) {
      likelyCauses.push(
        "The flowchart's direction must be `TB` (or `TD`), `BT`, `RL` or `LR`.",
      );
    }
    if (
      lines.some((line) => {
        const direction = line.match(/^\s*direction\s+(\S+)\s*$/)?.[1];
        return direction && !/^(?:TB|BT|RL|LR)$/.test(direction);
      })
    ) {
      likelyCauses.push(
        "A subgraph's `direction` must be `TB`, `BT`, `RL` or `LR`.",
      );
    }
  }

  if (/got '(?:PS|PE|SQS|SQE|DIAMOND_START|DIAMOND_STOP)'/.test(message)) {
    likelyCauses.push(
      'A label contains brackets or parentheses: wrap it in double quotes, e.g. `A["Label (detail)"]`.',
    );
  } else if (/got 'NODE_STRING'/.test(message)) {
    likelyCauses.push(
      "An extra character/token may appear after a node or label definition.",
    );
  }

  if (/got 'end'/.test(message)) {
    likelyCauses.push(
      "`end` is a reserved word: capitalize it (e.g. `End`) to use it as a node.",
    );
  }

  if (likelyCauses.length === 0) {
    likelyCauses.push(
      "A node or edge line is malformed (missing/extra delimiters).",
    );
    likelyCauses.push("A block (`subgraph`, `class`, etc.) may be incomplete.");
  }

  return {
    summary,
    likelyCauses: [...new Set(likelyCauses)],
  };
};

/** The error, reported on its line of `sourceText` (see `getMermaidSourceLineNumber`) */
export const withMermaidSourceLineNumber = (
  message: string,
  sourceText: string,
) =>
  message.replace(MERMAID_SYNTAX_ERROR_LINE, (match, line) =>
    match.replace(
      line,
      String(getMermaidSourceLineNumber(Number(line), sourceText)),
    ),
  );

/**
 * The parse error, without the tokens it expected, and if given the source,
 * on its line of it.
 */
export const formatMermaidParseErrorMessage = (
  message: string,
  sourceText?: string,
) => {
  if (!isMermaidParseSyntaxError(message)) {
    return message;
  }

  const formatted = message.replace(/\n\s*Expecting[\s\S]*$/, "").trimEnd();
  return sourceText
    ? withMermaidSourceLineNumber(formatted, sourceText)
    : formatted;
};

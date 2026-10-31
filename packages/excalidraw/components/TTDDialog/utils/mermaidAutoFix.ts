import {
  getMermaidDiagramType,
  getMermaidEndBlockOpener,
  getMermaidErrorLineNumber,
  getMermaidHeaderLineIndex,
  getMermaidInactiveParticipant,
  isMermaidAutoFixableError,
  isMermaidParseSyntaxError,
  isMermaidUnknownDiagramError,
  MERMAID_END_LINE,
} from "./mermaidError";

import type { MermaidDiagramType } from "./mermaidError";

const getErrorLineIndex = (message: string, sourceText: string) => {
  const lineNumber = getMermaidErrorLineNumber(message, sourceText);
  if (lineNumber == null) {
    return null;
  }
  return lineNumber - 1;
};

const replaceLineAt = (
  lines: string[],
  index: number,
  transform: (line: string) => string,
) => {
  if (index < 0 || index >= lines.length) {
    return null;
  }
  const nextLine = transform(lines[index]);
  if (nextLine === lines[index]) {
    return null;
  }
  const nextLines = [...lines];
  nextLines[index] = nextLine;
  return nextLines.join("\n");
};

const stripTrailingTokenAfterShape = (line: string) => {
  const alphaTailMatch = line.match(
    /^(.*(?:\[[^\]]*]|\([^)]*\)|\{[^}]*}|"(?:[^"]*)"|'(?:[^']*)'))([A-Za-z]+)\s*$/,
  );
  if (alphaTailMatch) {
    return alphaTailMatch[1];
  }

  const punctuationTailMatch = line.match(
    /^(.*(?:\[[^\]]*]|\([^)]*\)|\{[^}]*}|"(?:[^"]*)"|'(?:[^']*)'))([,;:])\s*$/,
  );
  if (punctuationTailMatch) {
    return punctuationTailMatch[1];
  }

  return line;
};

const removeExtraArrowheadAfterEdgeLabel = (line: string) => {
  // Common typo in generated Mermaid: `-->|label|> Target` (extra `>`).
  // Convert it to `-->|label| Target`.
  return line.replace(/(\|[^|\n]+\|)\s*>\s*(?=[A-Za-z0-9_("[{'`])/g, "$1 ");
};

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const removeLastDeactivateForParticipant = (
  sourceText: string,
  participant: string,
) => {
  const pattern = new RegExp(
    `^\\s*deactivate\\s+${escapeRegExp(participant)}(?:\\s+%%.*)?\\s*$`,
  );
  const lines = sourceText.split(/\r?\n/);

  for (let index = lines.length - 1; index >= 0; index--) {
    if (pattern.test(lines[index])) {
      return lines.filter((_, lineIndex) => lineIndex !== index).join("\n");
    }
  }

  return null;
};

const removeAllDeactivateForParticipant = (
  sourceText: string,
  participant: string,
) => {
  const pattern = new RegExp(
    `^\\s*deactivate\\s+${escapeRegExp(participant)}(?:\\s+%%.*)?\\s*$`,
  );
  const lines = sourceText.split(/\r?\n/);
  let removedAny = false;
  const remainingLines = lines.filter((line) => {
    if (!pattern.test(line)) {
      return true;
    }
    removedAny = true;
    return false;
  });

  return removedAny ? remainingLines.join("\n") : null;
};

const getIndentation = (line: string) => line.match(/^\s*/)![0].length;

/**
 * Closes the blocks (e.g. `subgraph`, `loop`, `class X {`) that aren't, as
 * their indentation tells: before the first line after their (indented) body
 * that isn't indented deeper than them, or with `atEnd`, all at the end.
 */
const closeUnclosedBlocks = (
  sourceText: string,
  opener: RegExp,
  isCloser: RegExp,
  closer: string,
  { atEnd = false } = {},
) => {
  const lines = sourceText.trimEnd().split(/\r?\n/);
  const unclosed: number[] = [];
  lines.forEach((line, index) => {
    if (opener.test(line)) {
      unclosed.push(index);
    } else if (isCloser.test(line)) {
      unclosed.pop();
    }
  });
  if (!unclosed.length) {
    return null;
  }

  // closers to insert before a line (or at the end, at `lines.length`)
  const insertions = new Map<number, string[]>();
  // innermost first
  for (const openerIndex of unclosed.reverse()) {
    const indentation = getIndentation(lines[openerIndex]);
    let index = openerIndex + 1;
    while (
      !atEnd &&
      index < lines.length &&
      (!lines[index].trim() || getIndentation(lines[index]) > indentation)
    ) {
      index++;
    }
    // without an indented body, where the block ends is anyone's guess
    if (atEnd || index === openerIndex + 1) {
      index = lines.length;
    }
    while (index - 1 > openerIndex && !lines[index - 1].trim()) {
      index--;
    }
    const line = `${lines[openerIndex].match(/^\s*/)![0]}${closer}`;
    insertions.set(index, [...(insertions.get(index) ?? []), line]);
  }

  const result: string[] = [];
  lines.forEach((line, index) => {
    result.push(...(insertions.get(index) ?? []), line);
  });
  result.push(...(insertions.get(lines.length) ?? []));
  return result.join("\n");
};

const BRACE_BLOCK_OPENER = /\{\s*$/;
const BRACE_BLOCK_CLOSER = /^\s*\}\s*$/;

/** `end`s and `}`s the diagram's unclosed blocks are missing */
const getUnclosedBlockCandidates = (
  sourceText: string,
  type: MermaidDiagramType | null,
) => {
  if (type === "class" || type === "state" || type === "er") {
    return [false, true].map((atEnd) =>
      closeUnclosedBlocks(
        sourceText,
        BRACE_BLOCK_OPENER,
        BRACE_BLOCK_CLOSER,
        "}",
        { atEnd },
      ),
    );
  }
  const opener = getMermaidEndBlockOpener(type) ?? /^\s*subgraph\b/;
  return [false, true].map((atEnd) =>
    closeUnclosedBlocks(sourceText, opener, MERMAID_END_LINE, "end", {
      atEnd,
    }),
  );
};

/**
 * Applies `transform` to the parts of a flowchart line outside its labels
 * (`[...]`, `(...)`, `{...}`, `|...|`, `"..."`).
 */
const mapOutsideLabels = (
  line: string,
  transform: (segment: string) => string,
) => {
  let result = "";
  let segment = "";
  let depth = 0;
  let inQuotes = false;
  let inPipes = false;
  for (const char of line) {
    const isLabel = depth > 0 || inQuotes || inPipes;
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (!inQuotes && char === "|" && depth === 0) {
      inPipes = !inPipes;
    } else if (!inQuotes && !inPipes && "[({".includes(char)) {
      depth++;
    } else if (!inQuotes && !inPipes && "])}".includes(char)) {
      depth = Math.max(0, depth - 1);
    }
    if (isLabel || depth > 0 || inQuotes || inPipes) {
      result += transform(segment) + char;
      segment = "";
    } else {
      segment += char;
    }
  }
  return result + transform(segment);
};

// `A[Process (main)]` -> `A["Process (main)"]`: labels with brackets or
// parentheses in them are only allowed quoted (skipping shapes that start
// with a bracket, e.g. `[[subroutine]]`, `[(cylinder)]`, `((circle))`)
const UNQUOTED_LABELS_WITH_BRACKETS: Array<[RegExp, string]> = [
  [/([\w-]+)\[(?![[(/\\])([^[\]"]*?[(){}][^[\]"]*?)\](?!\])/g, '$1["$2"]'],
  [/([\w-]+)\{(?!\{)([^{}"]*?[()[\]][^{}"]*?)\}(?!\})/g, '$1{"$2"}'],
  [/([\w-]+)\((?![([])([^()"]*?[[\]{}][^()"]*?)\)(?!\))/g, '$1("$2")'],
  [/([\w-]+)\((?![([])([^()"]*\([^()"]*\)[^()"]*)\)(?!\))/g, '$1("$2")'],
];

const quoteLabelsWithBrackets = (text: string) =>
  UNQUOTED_LABELS_WITH_BRACKETS.reduce(
    (result, [pattern, replacement]) => result.replace(pattern, replacement),
    text,
  );

const FLOWCHART_ARROW = /\s*(?:<?-->|<?---|<?-\.->|-\.-|<?==>|===|--[ox])/;
const SHAPE_CLOSERS: Record<string, string> = { "[": "]", "(": ")", "{": "}" };

/**
 * Closes a flowchart node's label left open on the line: before the edge
 * after it (`A[Start --> B` -> `A[Start] --> B`), or at the end of the line.
 */
const closeUnclosedShape = (line: string) => {
  const openers: number[] = [];
  let inQuotes = false;
  for (let index = 0; index < line.length; index++) {
    const char = line[index];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (!inQuotes && char in SHAPE_CLOSERS) {
      openers.push(index);
    } else if (!inQuotes && "])}".includes(char)) {
      openers.pop();
    }
  }
  if (!openers.length) {
    return [];
  }
  const opener = openers[openers.length - 1];
  const closer = SHAPE_CLOSERS[line[opener]];
  const arrow = line.slice(opener).search(FLOWCHART_ARROW);
  return [
    ...(arrow > 0
      ? [
          `${line.slice(0, opener + arrow)}${closer}${line.slice(
            opener + arrow,
          )}`,
        ]
      : []),
    `${line.trimEnd()}${closer}`,
  ];
};

/** Drops the closing brackets on a flowchart line that close nothing */
const removeUnmatchedClosers = (line: string) => {
  const openers: string[] = [];
  let inQuotes = false;
  let result = "";
  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (!inQuotes && char in SHAPE_CLOSERS) {
      openers.push(SHAPE_CLOSERS[char]);
    } else if (!inQuotes && "])}".includes(char)) {
      if (openers[openers.length - 1] !== char) {
        continue;
      }
      openers.pop();
    }
    result += char;
  }
  return result;
};

const replaceSingleDashArrows = (text: string) =>
  text.replace(/(^|[^-<=.])->(?!>)/g, "$1-->");

// `A -> B` -> `A --> B` (flowcharts and state diagrams have no `->`)
const fixSingleDashArrows = (line: string) =>
  mapOutsideLabels(line, replaceSingleDashArrows);

// ... in state diagrams, before their transitions' label (`A -> B : x`)
const fixStateSingleDashArrows = (line: string) => {
  const labelStart = line.indexOf(":");
  return labelStart === -1
    ? replaceSingleDashArrows(line)
    : `${replaceSingleDashArrows(line.slice(0, labelStart))}${line.slice(
        labelStart,
      )}`;
};

// `A --> end` -> `A --> End`: `end` closes subgraphs, it can't be a node
const capitalizeEndNodes = (line: string) =>
  MERMAID_END_LINE.test(line)
    ? line
    : mapOutsideLabels(line, (segment) =>
        segment.replace(/(^|[\s&;>])end(?=$|[\s&;[({]|--|==|-\.)/g, "$1End"),
      );

// `Alice->>Bob hi` -> `Alice->>Bob: hi`
const addSequenceMessageColon = (line: string) =>
  line.replace(
    /^(\s*[^\s:]+?\s*(?:<<-->>|<<->>|-->>|->>|-->|->|--x|-x|--\)|-\))\s*[+-]?[^\s:]+)\s+([^\s:].*)$/,
    "$1: $2",
  );

// `A ||--o{ B places` -> `A ||--o{ B : places`
const addRelationshipColon = (line: string) =>
  line.replace(
    /^(\s*[\w-]+\s+[|o{}]{1,2}(?:--|\.\.)[|o{}]{1,2}\s+[\w-]+)\s+([^\s:].*)$/,
    "$1 : $2",
  );

const FLOWCHART_DIRECTIONS = new Set(["TB", "TD", "BT", "RL", "LR"]);

// `flowchart XY` -> `flowchart TD`
const fixFlowchartDirection = (line: string) =>
  line.replace(
    /^(\s*(?:flowchart|graph)\s+)(\S+)/,
    (match, keyword, direction) =>
      FLOWCHART_DIRECTIONS.has(direction.toUpperCase())
        ? `${keyword}${direction.toUpperCase()}`
        : `${keyword}TD`,
  );

const countMatches = (text: string, pattern: RegExp) =>
  (text.match(pattern) || []).length;

const DIRECTION_STATEMENT = /^(\s*direction\s+)(\S+)\s*$/;
// `TD` is only one in a flowchart's header
const DIRECTION_STATEMENT_DIRECTIONS = new Set(["TB", "BT", "RL", "LR"]);

/**
 * `direction lr` -> `direction LR` in a flowchart's subgraphs, without the
 * statements that aren't any direction (for the subgraph to keep the
 * flowchart's), or with `remove`, without any (sequence diagrams have none).
 */
const fixDirectionStatements = (lines: string[], { remove = false } = {}) => {
  const result = lines.flatMap((line) => {
    const match = line.match(DIRECTION_STATEMENT);
    if (!match) {
      return [line];
    }
    const direction = match[2].toUpperCase() === "TD" ? "TB" : match[2];
    return !remove &&
      DIRECTION_STATEMENT_DIRECTIONS.has(direction.toUpperCase())
      ? [`${match[1]}${direction.toUpperCase()}`]
      : [];
  });
  return result.join("\n");
};

/**
 * A direction on the first line of a class (`classDiagram LR`), state or ER
 * diagram (`erDiagram direction LR`), which they only take as a `direction`
 * statement: `classDiagram` + `direction LR` on the next line (unless they
 * have one already). Sequence diagrams have none.
 */
const fixHeaderDirection = (
  sourceText: string,
  type: MermaidDiagramType | null,
) => {
  const headerIndex = getMermaidHeaderLineIndex(sourceText);
  if (
    headerIndex === null ||
    (type !== "class" &&
      type !== "state" &&
      type !== "er" &&
      type !== "sequence")
  ) {
    return null;
  }
  const lines = sourceText.split(/\r?\n/);
  const match = lines[headerIndex].match(/^(\s*\S+)\s+(.+?)\s*$/);
  if (!match) {
    return null;
  }
  const [, header, rest] = match;
  const value = rest.match(/^(?:direction\s+)?(\S+)$/)?.[1];
  if (!value && type !== "sequence") {
    return null;
  }
  const direction = value?.toUpperCase() === "TD" ? "TB" : value?.toUpperCase();
  const bodyLines = lines.slice(headerIndex + 1);
  // the diagram's, not one of a composite state's (`state X {`)
  let depth = 0;
  const hasDirectionStatement = bodyLines.some((line) => {
    const isTopLevel = depth === 0;
    depth += countMatches(line, /\{/g) - countMatches(line, /\}/g);
    return isTopLevel && DIRECTION_STATEMENT.test(line);
  });
  const body = bodyLines.find((line) => line.trim());
  const statement =
    type !== "sequence" &&
    !hasDirectionStatement &&
    direction &&
    DIRECTION_STATEMENT_DIRECTIONS.has(direction)
      ? [`${body?.match(/^\s*/)![0] || "  "}direction ${direction}`]
      : [];
  return [
    ...lines.slice(0, headerIndex),
    header,
    ...statement,
    ...lines.slice(headerIndex + 1),
  ].join("\n");
};

const DIAGRAM_KEYWORDS = [
  "flowchart",
  "graph",
  "sequenceDiagram",
  "classDiagram",
  "stateDiagram-v2",
  "stateDiagram",
  "erDiagram",
];

const getEditDistance = (a: string, b: string) => {
  const distances = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    let previous = distances[0];
    distances[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const current = distances[j];
      distances[j] = Math.min(
        distances[j] + 1,
        distances[j - 1] + 1,
        previous + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      previous = current;
    }
  }
  return distances[b.length];
};

/**
 * Fixes the misspelled diagram type of a definition (`flowchar TD`,
 * `sequencediagram`), or declares it if it's missing, as its first line
 * suggests.
 */
const getDiagramTypeCandidates = (sourceText: string) => {
  const lines = sourceText.split(/\r?\n/);
  const headerIndex = getMermaidHeaderLineIndex(sourceText);
  if (headerIndex === null) {
    return [];
  }
  const header = lines[headerIndex];
  const [, indentation, keyword, rest] = header.match(/^(\s*)(\S+)(.*)$/)!;
  const withHeader = (nextHeader: string) =>
    [
      ...lines.slice(0, headerIndex),
      nextHeader,
      ...lines.slice(headerIndex + 1),
    ].join("\n");
  const withHeaderBefore = (newHeader: string) =>
    [
      ...lines.slice(0, headerIndex),
      newHeader,
      ...lines.slice(headerIndex),
    ].join("\n");

  const [closest] = DIAGRAM_KEYWORDS.map((candidate) => ({
    candidate,
    distance: getEditDistance(keyword.toLowerCase(), candidate.toLowerCase()),
  })).sort((a, b) => a.distance - b.distance);
  const candidates: string[] = [];
  if (closest.distance <= Math.min(2, Math.floor(keyword.length / 3))) {
    candidates.push(withHeader(`${indentation}${closest.candidate}${rest}`));
  }
  // no diagram type at all
  if (/-->>|->>/.test(header)) {
    candidates.push(withHeaderBefore("sequenceDiagram"));
  } else if (/-->|---|==>|-\.->/.test(header)) {
    candidates.push(withHeaderBefore("flowchart TD"));
  }
  return candidates;
};

const normalizeSmartQuotes = (sourceText: string) =>
  sourceText.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");

export const getMermaidAutoFixCandidates = (
  sourceText: string,
  errorMessage: string,
) => {
  if (!isMermaidAutoFixableError(errorMessage) || !sourceText.trim()) {
    return [];
  }

  const candidates: string[] = [];
  const seen = new Set<string>();
  const addCandidate = (candidate: string | null) => {
    if (!candidate || candidate === sourceText || seen.has(candidate)) {
      return;
    }
    seen.add(candidate);
    candidates.push(candidate);
  };

  if (isMermaidUnknownDiagramError(errorMessage)) {
    getDiagramTypeCandidates(sourceText).forEach(addCandidate);
    return candidates;
  }

  const inactiveParticipant = getMermaidInactiveParticipant(errorMessage);
  if (inactiveParticipant) {
    addCandidate(
      removeLastDeactivateForParticipant(sourceText, inactiveParticipant),
    );
    // Fallback for repeated invalid inactivations in one diagram.
    addCandidate(
      removeAllDeactivateForParticipant(sourceText, inactiveParticipant),
    );
  }

  if (isMermaidParseSyntaxError(errorMessage)) {
    const type = getMermaidDiagramType(sourceText);
    const lines = sourceText.split(/\r?\n/);
    const errorLineIndex = getErrorLineIndex(errorMessage, sourceText);
    const lineIndexesToTry =
      errorLineIndex == null
        ? []
        : [errorLineIndex, errorLineIndex - 1, errorLineIndex + 1];
    // fixes of a line, and of all of them (e.g. a mistake repeated on others)
    const lineFixes: Array<(line: string) => string> = [];
    const textFixes: Array<(line: string) => string> = [
      removeExtraArrowheadAfterEdgeLabel,
    ];

    if (type === "flowchart") {
      lineFixes.push(
        quoteLabelsWithBrackets,
        fixSingleDashArrows,
        removeUnmatchedClosers,
      );
      textFixes.push(
        quoteLabelsWithBrackets,
        fixSingleDashArrows,
        capitalizeEndNodes,
      );
    } else if (type === "state") {
      lineFixes.push(fixStateSingleDashArrows);
      textFixes.push(fixStateSingleDashArrows);
    } else if (type === "sequence") {
      lineFixes.push(addSequenceMessageColon);
    } else if (type === "er") {
      lineFixes.push(addRelationshipColon);
      textFixes.push(addRelationshipColon);
    }

    for (const lineIndex of lineIndexesToTry) {
      addCandidate(
        replaceLineAt(lines, lineIndex, (line) =>
          stripTrailingTokenAfterShape(line),
        ),
      );
      addCandidate(
        replaceLineAt(lines, lineIndex, (line) =>
          removeExtraArrowheadAfterEdgeLabel(line),
        ),
      );
      for (const fix of lineFixes) {
        addCandidate(replaceLineAt(lines, lineIndex, fix));
      }
      if (type === "flowchart" && lineIndex >= 0 && lineIndex < lines.length) {
        for (const closed of closeUnclosedShape(lines[lineIndex])) {
          addCandidate(replaceLineAt(lines, lineIndex, () => closed));
        }
      }
    }

    // Also try full-text replacement so repeated occurrences on other lines
    // are fixed together in a single candidate.
    for (const fix of textFixes) {
      addCandidate(lines.map(fix).join("\n"));
    }

    if (type === "flowchart" || type === "sequence") {
      addCandidate(
        fixDirectionStatements(lines, { remove: type === "sequence" }),
      );
    }

    addCandidate(fixHeaderDirection(sourceText, type));

    getUnclosedBlockCandidates(sourceText, type).forEach(addCandidate);

    if (type === "flowchart") {
      const headerIndex = getMermaidHeaderLineIndex(sourceText);
      if (headerIndex !== null) {
        addCandidate(replaceLineAt(lines, headerIndex, fixFlowchartDirection));
      }
    }

    const normalizedQuotes = normalizeSmartQuotes(sourceText);
    addCandidate(normalizedQuotes === sourceText ? null : normalizedQuotes);
  }

  return candidates;
};

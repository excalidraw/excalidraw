const MERMAID_SYNTAX_ERROR_LINE = /(?:Parse|Lexical) error on line (\d+)[.:]/i;
const MERMAID_INACTIVE_PARTICIPANT_ERROR =
  /Trying to inactivate an inactive participant \((.+)\)/i;
const MERMAID_CARET_LINE = /^\s*-+\^\s*$/;

/**
 * Matches minified runtime errors thrown by the mermaid renderer, e.g.:
 *   "can't access property \"type\", Z[e].raw.startTime is undefined"
 * These contain uppercase single-letter variables followed by bracket access.
 */
const MERMAID_MINIFIED_RUNTIME_ERROR = /\b[A-Z]\[/;

/**
 * Matches any "X is undefined/null" message that references a dot-path
 * property, which indicates a mermaid-internal rendering failure.
 */
const MERMAID_PROPERTY_UNDEFINED_ERROR =
  /\b\w+(?:\.\w+)+\s+is\s+(?:undefined|null)\b/i;

export const isMermaidParseSyntaxError = (message: string) =>
  MERMAID_SYNTAX_ERROR_LINE.test(message);

export const isMermaidAutoFixableError = (message: string) =>
  isMermaidParseSyntaxError(message) ||
  MERMAID_INACTIVE_PARTICIPANT_ERROR.test(message);

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
    return getInactiveParticipantLineNumber(message, sourceText);
  }
  return Number.parseInt(match[1], 10);
};

const countMatches = (text: string, re: RegExp) =>
  (text.match(re) || []).length;

export const getMermaidSyntaxErrorGuidance = (
  message: string,
  sourceText?: string,
): { summary: string; likelyCauses: string[] } | null => {
  if (!isMermaidParseSyntaxError(message)) {
    return null;
  }

  const errorLine = getMermaidErrorLineNumber(message, sourceText);
  const summary = errorLine
    ? `Syntax error near line ${errorLine}.`
    : "Syntax error in Mermaid diagram.";

  const likelyCauses: string[] = [];

  if (sourceText) {
    const openBrackets = countMatches(sourceText, /\[/g);
    const closeBrackets = countMatches(sourceText, /\]/g);
    if (openBrackets !== closeBrackets) {
      likelyCauses.push("Unbalanced square brackets in a node label.");
    }

    const openParens = countMatches(sourceText, /\(/g);
    const closeParens = countMatches(sourceText, /\)/g);
    if (openParens !== closeParens) {
      likelyCauses.push("Unbalanced parentheses in a node shape.");
    }

    const openBraces = countMatches(sourceText, /\{/g);
    const closeBraces = countMatches(sourceText, /\}/g);
    if (openBraces !== closeBraces) {
      likelyCauses.push("Unbalanced braces in a decision node.");
    }

    const subgraphCount = countMatches(sourceText, /^\s*subgraph\b/gm);
    const endCount = countMatches(sourceText, /^\s*end\s*$/gm);
    if (subgraphCount > endCount) {
      likelyCauses.push("A block is missing an `end` statement.");
    }
  }

  if (/got 'NODE_STRING'/.test(message) || /got 'PS'/.test(message)) {
    likelyCauses.push(
      "An extra character/token may appear after a node or label definition.",
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

export const formatMermaidParseErrorMessage = (message: string) => {
  if (!isMermaidParseSyntaxError(message)) {
    return message;
  }

  return message.replace(/\n\s*Expecting[\s\S]*$/, "").trimEnd();
};

/**
 * Returns true when the error originates from mermaid's internal rendering
 * pipeline rather than its parser/lexer. These errors typically contain
 * minified variable names (e.g. "Z[e].raw.startTime is undefined") and are
 * not meaningful to end users.
 */
export const isMermaidRenderingError = (message: string): boolean => {
  if (isMermaidParseSyntaxError(message)) {
    return false;
  }
  return (
    MERMAID_MINIFIED_RUNTIME_ERROR.test(message) ||
    MERMAID_PROPERTY_UNDEFINED_ERROR.test(message)
  );
};

/**
 * Converts a mermaid internal rendering error into a user-friendly Error.
 * Pass the original mermaid definition so that diagram-specific guidance can
 * be included where possible.
 */
export const sanitizeMermaidRenderingError = (
  err: Error,
  mermaidDefinition?: string,
): Error => {
  if (!isMermaidRenderingError(err.message)) {
    return err;
  }

  const isGantt = /^\s*gantt\b/i.test(mermaidDefinition ?? "");
  const mentionsTime = /(?:start|end)Time/i.test(err.message);

  if (isGantt || mentionsTime) {
    return new Error(
      "Unable to render gantt diagram: one or more tasks have an invalid time " +
        "range. If a task crosses midnight (e.g. 22:00 → 06:00), split it into " +
        "two separate tasks ending at 23:59 and starting at 00:00.",
    );
  }

  return new Error(
    "Unable to render diagram: an internal rendering error occurred. The " +
      "diagram definition may contain unsupported syntax or values.",
  );
};

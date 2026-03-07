import {
  getMermaidErrorLineNumber,
  getMermaidInactiveParticipant,
  isMermaidAutoFixableError,
  isMermaidParseSyntaxError,
} from "./mermaidError";

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

const appendMissingEnds = (sourceText: string) => {
  const subgraphCount = (sourceText.match(/^\s*subgraph\b/gm) || []).length;
  const endCount = (sourceText.match(/^\s*end\s*$/gm) || []).length;
  const missingCount = subgraphCount - endCount;

  if (missingCount <= 0) {
    return null;
  }

  const endings = Array.from({ length: missingCount }, () => "end").join("\n");
  return `${sourceText.trimEnd()}\n${endings}`;
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
    const lines = sourceText.split(/\r?\n/);
    const errorLineIndex = getErrorLineIndex(errorMessage, sourceText);
    const lineIndexesToTry =
      errorLineIndex == null
        ? []
        : [errorLineIndex, errorLineIndex - 1, errorLineIndex + 1];

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
    }

    // Also try full-text replacement so repeated occurrences on other lines
    // are fixed together in a single candidate.
    addCandidate(removeExtraArrowheadAfterEdgeLabel(sourceText));

    addCandidate(appendMissingEnds(sourceText));

    const normalizedQuotes = normalizeSmartQuotes(sourceText);
    addCandidate(normalizedQuotes === sourceText ? null : normalizedQuotes);
  }

  return candidates;
};

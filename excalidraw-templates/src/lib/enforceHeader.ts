// Deterministic type routing: this is the fix for the flowchart-prompt
// returning a class-diagram bug (docs/spike-mermaid.md and the workflow
// doc's §6.3/§6.4). The model's mermaid output is never trusted as-is —
// its header is forced to match the selected template before the result
// is handed to insertDiagram.ts.

const DIAGRAM_KEYWORDS = [
  "flowchart",
  "graph",
  "mindmap",
  "classDiagram",
  "sequenceDiagram",
  "erDiagram",
  "stateDiagram",
];

const DIRECTIVE_KEYWORDS = ["style", "classDef", "class", "click", "init"];

const DIAGRAM_KEYWORD_RE = new RegExp(`^(${DIAGRAM_KEYWORDS.join("|")})\\b`);
const DIRECTIVE_RE = new RegExp(`^(${DIRECTIVE_KEYWORDS.join("|")})\\b`);

function stripCodeFences(input: string): string {
  let s = input.trim();
  s = s.replace(/^```[a-zA-Z]*\s*\n?/, "");
  s = s.replace(/\n?```\s*$/, "");
  return s.trim();
}

function getFirstNonEmptyLine(stripped: string): string | null {
  const lines = stripped.split("\n");
  const idx = lines.findIndex((line) => line.trim().length > 0);
  return idx === -1 ? null : lines[idx].trim();
}

/**
 * Whether enforceHeader would actually change something for this input —
 * i.e. the model's raw header didn't already match. This is what
 * type_mismatch_corrected (src/lib/events.ts) is built on: it's the one
 * number that tells us whether the routing guarantee is doing work or
 * sitting idle. Pure, same fence/whitespace handling as enforceHeader.
 */
export function wasHeaderCorrected(mermaid: string, header: string): boolean {
  const expectedHeader = header.trim();
  const stripped = stripCodeFences(mermaid);
  const firstLine = getFirstNonEmptyLine(stripped);
  return firstLine !== expectedHeader;
}

/**
 * Forces mermaid source to open with the given header (e.g. "flowchart TD").
 * Pure: same input always produces the same output, no I/O.
 *
 * - Strips ``` code fences and surrounding whitespace.
 * - If the first non-empty line isn't exactly `header`: replaces it when it
 *   starts with a recognized mermaid diagram-type keyword (so a model that
 *   returned the wrong type gets corrected in place), otherwise prepends
 *   `header` as a new first line (the model returned body content with no
 *   type declaration at all).
 * - Drops style/classDef/class/click/init directive lines anywhere in the
 *   body — styling/interaction directives we don't want passed through
 *   from an untrusted model response.
 */
export function enforceHeader(mermaid: string, header: string): string {
  const expectedHeader = header.trim();
  const stripped = stripCodeFences(mermaid);

  if (stripped.length === 0) {
    return expectedHeader;
  }

  const lines = stripped.split("\n");
  const firstIdx = lines.findIndex((line) => line.trim().length > 0);

  if (firstIdx === -1) {
    return expectedHeader;
  }

  const firstLine = lines[firstIdx].trim();
  let resultLines: string[];

  if (firstLine === expectedHeader) {
    resultLines = lines;
  } else if (DIAGRAM_KEYWORD_RE.test(firstLine)) {
    resultLines = [...lines];
    resultLines[firstIdx] = expectedHeader;
  } else {
    resultLines = [expectedHeader, ...lines];
  }

  resultLines = resultLines.filter(
    (line) => !DIRECTIVE_RE.test(line.trim()),
  );

  return resultLines.join("\n").trim();
}

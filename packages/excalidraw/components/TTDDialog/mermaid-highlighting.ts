export type MermaidHighlightTokenType =
  | "bracket"
  | "comment"
  | "keyword"
  | "number"
  | "operator"
  | "punctuation"
  | "string"
  | "variableName";

export type MermaidHighlightToken = {
  type: MermaidHighlightTokenType | null;
  value: string;
};

const DIAGRAM_TYPE_PATTERN =
  /^(flowchart|graph|sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|pie|mindmap|journey|gitGraph|timeline|quadrantChart|sankey|xychart)\b/i;
const DIRECTION_PATTERN = /^(TB|TD|BT|RL|LR)\b/;
const KEYWORD_PATTERN =
  /^(subgraph|end|participant|actor|loop|alt|else|opt|par|critical|break|rect|note|over|activate|deactivate|title|section|class|style|linkStyle|classDef|click)\b/i;

const MERMAID_TOKEN_RULES: ReadonlyArray<{
  pattern: RegExp;
  type: MermaidHighlightTokenType | null;
}> = [
  { pattern: /^%%[^\n]*/, type: "comment" },
  { pattern: /^"(?:[^"\\]|\\.)*"/, type: "string" },
  { pattern: DIAGRAM_TYPE_PATTERN, type: "keyword" },
  { pattern: DIRECTION_PATTERN, type: "keyword" },
  { pattern: KEYWORD_PATTERN, type: "keyword" },
  { pattern: /^[-.=<>|ox]+>/, type: "operator" },
  { pattern: /^<[-.=<>|ox]+/, type: "operator" },
  { pattern: /^(--+|\.\.+|==+)/, type: "operator" },
  { pattern: /^[[\](){}|<>]/, type: "bracket" },
  { pattern: /^[A-Za-z_][A-Za-z0-9_]*/, type: "variableName" },
  { pattern: /^\d+(\.\d+)?/, type: "number" },
  { pattern: /^[,:;]/, type: "punctuation" },
  { pattern: /^\s+/, type: null },
];

export const getMermaidHighlightToken = (
  input: string,
): MermaidHighlightToken | null => {
  if (!input) {
    return null;
  }

  for (const rule of MERMAID_TOKEN_RULES) {
    const match = input.match(rule.pattern);
    if (match) {
      return {
        type: rule.type,
        value: match[0],
      };
    }
  }

  return {
    type: null,
    value: input[0],
  };
};

export const tokenizeMermaid = (input: string): MermaidHighlightToken[] => {
  const tokens: MermaidHighlightToken[] = [];
  let remaining = input;

  while (remaining) {
    const token = getMermaidHighlightToken(remaining);
    if (!token) {
      break;
    }

    tokens.push(token);
    remaining = remaining.slice(token.value.length);
  }

  return tokens;
};

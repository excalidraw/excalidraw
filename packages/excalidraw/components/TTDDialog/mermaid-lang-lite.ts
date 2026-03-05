import { StreamLanguage } from "@codemirror/language";

const mermaidStreamParser = StreamLanguage.define({
  token(stream) {
    // Comments: %%...
    if (stream.match(/^%%.*$/)) {
      return "comment";
    }

    // Strings
    if (stream.match(/^"(?:[^"\\]|\\.)*"/)) {
      return "string";
    }

    // Diagram type keywords (at start of line or after whitespace)
    if (
      stream.match(
        /^(flowchart|graph|sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|pie|mindmap|journey|gitGraph|timeline|quadrantChart|sankey|xychart)\b/i,
      )
    ) {
      return "keyword";
    }

    // Direction keywords
    if (stream.match(/^(TB|TD|BT|RL|LR)\b/)) {
      return "keyword";
    }

    // Keywords
    if (
      stream.match(
        /^(subgraph|end|participant|actor|loop|alt|else|opt|par|critical|break|rect|note|over|activate|deactivate|title|section|class|style|linkStyle|classDef|click)\b/i,
      )
    ) {
      return "keyword";
    }

    // Arrows: -->, ---, -.->, ===>, etc.
    if (stream.match(/^[-.=<>|ox]+>/)) {
      return "operator";
    }
    if (stream.match(/^<[-.=<>|ox]+/)) {
      return "operator";
    }
    if (stream.match(/^--+|\.\.+|==+/)) {
      return "operator";
    }

    // Labels in brackets/parens: [text], (text), {text}, ((text)), etc.
    if (stream.match(/^[[\](){}|<>]/)) {
      return "bracket";
    }

    // Node IDs (alphanumeric)
    if (stream.match(/^[A-Za-z_][A-Za-z0-9_]*/)) {
      return "variableName";
    }

    // Numbers
    if (stream.match(/^\d+(\.\d+)?/)) {
      return "number";
    }

    // Punctuation
    if (stream.match(/^[,:;]/)) {
      return "punctuation";
    }

    // Skip whitespace
    if (stream.eatSpace()) {
      return null;
    }

    // Skip any other character
    stream.next();
    return null;
  },
});

export function mermaidLite() {
  return mermaidStreamParser;
}

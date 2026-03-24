import { StreamLanguage } from "@codemirror/language";

import { getMermaidHighlightToken } from "./mermaid-highlighting";

const mermaidStreamParser = StreamLanguage.define({
  token(stream) {
    const token = getMermaidHighlightToken(stream.string.slice(stream.pos));
    if (!token) {
      stream.skipToEnd();
      return null;
    }

    stream.pos += token.value.length;
    return token.type;
  },
});

export function mermaidLite() {
  return mermaidStreamParser;
}

import { describe, expect, it } from "vitest";

import {
  formatMermaidParseErrorMessage,
  getMermaidErrorLineNumber,
  getMermaidInactiveParticipant,
  getMermaidSyntaxErrorGuidance,
  isMermaidAutoFixableError,
  isMermaidParseSyntaxError,
  isMermaidCaretLine,
} from "./mermaidError";

describe("formatMermaidParseErrorMessage", () => {
  it("strips the noisy Expecting clause from Mermaid parse errors", () => {
    const message = `Parse error on line 6:
... Control Protocol)"]x          L3_UDP
----------------------^
Expecting 'SEMI', 'NEWLINE', 'SPACE', got 'NODE_STRING'`;

    expect(formatMermaidParseErrorMessage(message)).toBe(`Parse error on line 6:
... Control Protocol)"]x          L3_UDP
----------------------^`);
  });

  it("keeps Mermaid parse errors unchanged when no Expecting clause exists", () => {
    const message = `Parse error on line 3:
... some snippet
----^`;

    expect(formatMermaidParseErrorMessage(message)).toBe(message);
  });

  it("does not modify non-Mermaid parse messages", () => {
    const message =
      "Unexpected token while parsing JSON. Expecting value at position 10.";

    expect(formatMermaidParseErrorMessage(message)).toBe(message);
  });
});

describe("isMermaidCaretLine", () => {
  it("returns true for Mermaid caret lines", () => {
    expect(isMermaidCaretLine("-----------------------^")).toBe(true);
  });

  it("returns false for regular lines", () => {
    expect(isMermaidCaretLine(`... Control Protocol)"]x`)).toBe(false);
  });
});

describe("isMermaidParseSyntaxError", () => {
  it("returns true for Mermaid parser syntax errors", () => {
    expect(isMermaidParseSyntaxError("Parse error on line 6: ...")).toBe(true);
  });

  it("returns true for Mermaid lexical syntax errors", () => {
    expect(
      isMermaidParseSyntaxError("Lexical error on line 2. Unrecognized text."),
    ).toBe(true);
  });

  it("returns false for non-parse errors", () => {
    expect(isMermaidParseSyntaxError("Network error")).toBe(false);
  });
});

describe("isMermaidAutoFixableError", () => {
  it("returns true for Mermaid parser syntax errors", () => {
    expect(isMermaidAutoFixableError("Parse error on line 6: ...")).toBe(true);
  });

  it("returns true for inactive participant runtime errors", () => {
    expect(
      isMermaidAutoFixableError(
        "Trying to inactivate an inactive participant (QA)",
      ),
    ).toBe(true);
  });

  it("returns false for non-fixable errors", () => {
    expect(isMermaidAutoFixableError("Network error")).toBe(false);
  });
});

describe("getMermaidInactiveParticipant", () => {
  it("extracts the participant id from inactive participant errors", () => {
    expect(
      getMermaidInactiveParticipant(
        "Trying to inactivate an inactive participant (QA)",
      ),
    ).toBe("QA");
  });

  it("returns null for unrelated errors", () => {
    expect(
      getMermaidInactiveParticipant("Parse error on line 3: ..."),
    ).toBeNull();
  });
});

describe("getMermaidErrorLineNumber", () => {
  it("extracts line number from parse error format", () => {
    expect(getMermaidErrorLineNumber("Parse error on line 6: ...")).toBe(6);
  });

  it("extracts line number from lexical error format", () => {
    expect(
      getMermaidErrorLineNumber("Lexical error on line 2. Unrecognized text."),
    ).toBe(2);
  });

  it("returns null for messages without Mermaid line details", () => {
    expect(getMermaidErrorLineNumber("Network error")).toBeNull();
  });

  it("infers line from inactive participant errors when source text is provided", () => {
    const sourceText = `sequenceDiagram
  participant QA
  deactivate QA
  QA->>QA: Verifies Fix
  deactivate QA`;

    expect(
      getMermaidErrorLineNumber(
        "Trying to inactivate an inactive participant (QA)",
        sourceText,
      ),
    ).toBe(5);
  });
});

describe("getMermaidSyntaxErrorGuidance", () => {
  it("returns summary and likely causes for Mermaid parse errors", () => {
    const message = `Parse error on line 6:
... Control Protocol)"]x
----------------------^`;

    const source = `graph TD
subgraph Layers["X"]
  L3_TCP["TCP (Transmission Control Protocol)"]x`;

    expect(getMermaidSyntaxErrorGuidance(message, source)).toEqual({
      summary: "Syntax error near line 6.",
      likelyCauses: expect.arrayContaining([
        "A block is missing an `end` statement.",
      ]),
    });
  });

  it("returns null for non-parse errors", () => {
    expect(
      getMermaidSyntaxErrorGuidance("Network error", "graph TD"),
    ).toBeNull();
  });
});

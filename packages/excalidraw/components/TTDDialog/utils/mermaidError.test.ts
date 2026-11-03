import { describe, expect, it } from "vitest";

import {
  formatMermaidParseErrorMessage,
  getMermaidDiagramType,
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

  it("reports the error on its source line, given the source", () => {
    expect(
      formatMermaidParseErrorMessage(
        `Parse error on line 3:
  C --> D]
---------^
Expecting 'SEMI', got 'SQE'`,
        "%% a\n%% b\nflowchart TD\n  A --> B\n  C --> D]",
      ),
    ).toBe(`Parse error on line 5:
  C --> D]
---------^`);
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

  it("returns true for unknown diagram types", () => {
    expect(
      isMermaidAutoFixableError("No diagram type detected for the given text."),
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
  it("reports errors after the last line on the last line", () => {
    expect(
      getMermaidErrorLineNumber(
        "Parse error on line 4: ...",
        "graph TD\nsubgraph A\n  A1[Start]\n",
      ),
    ).toBe(3);
  });

  it("maps lines as Mermaid and Pele number them to the source's", () => {
    // [source, the line they report the error on line `actual` on]
    const cases: Array<[string, number, number]> = [
      ["%% a\n%% b\nflowchart TD\n  A --> B\n  C --> D]", 3, 5],
      ["flowchart TD\n  %% c\n  A --> B\n  C --> D]", 3, 4],
      ["\n\nflowchart TD\n  A --> B\n  C --> D]", 3, 5],
      ["flowchart TD\n\n  A --> B\n\n  C --> D]", 5, 5],
      ["---\ntitle: x\n---\nflowchart TD\n  A --> B\n  C --> D]", 3, 6],
      ["%%{init: {'theme':'dark'}}%%\nflowchart TD\n  C --> D]", 2, 3],
      ["flowchart TD\n  %%\n  A --> B\n  C --> D]", 4, 4],
      // a flowchart line ending with a comment runs on into the next one
      ["flowchart TD\n  A --> B %% note\n  C --> D]", 2, 2],
      ["sequenceDiagram\n  Alice->>Bob: hi %% note\n  Alice-B: x", 3, 3],
      ["classDiagram\n  %% c\n  A <|-- B\n  A <|-|> C", 3, 4],
    ];
    for (const [source, reported, actual] of cases) {
      expect(
        getMermaidErrorLineNumber(`Parse error on line ${reported}:`, source),
      ).toBe(actual);
    }
  });

  it("reports unknown diagram types on the line declaring it", () => {
    expect(
      getMermaidErrorLineNumber(
        "No diagram type detected for the given text.",
        "%% comment\nflowchar TD\n  A --> B",
      ),
    ).toBe(2);
  });

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
  L0["Physical"]
  L1["Data link"]
  L2["Network"]
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

  it("names the block a brace is missing from by diagram type", () => {
    const message = `Parse error on line 4:
  Animal <|-- Duck
------------------^`;

    expect(
      getMermaidSyntaxErrorGuidance(
        message,
        `classDiagram
  class Animal {
    +int age
  Animal <|-- Duck`,
      )?.likelyCauses,
    ).toEqual(["A class body is missing its closing `}`."]);
    expect(
      getMermaidSyntaxErrorGuidance(
        message,
        `flowchart TD
  A --> B{Is it?
  B --> C`,
      )?.likelyCauses,
    ).toEqual(["Unbalanced braces in a decision node."]);
  });

  it("counts the sequence blocks closed by `end`", () => {
    expect(
      getMermaidSyntaxErrorGuidance(
        `Parse error on line 4:
    Bob->>Alice: ping
---------------------^`,
        `sequenceDiagram
  Alice->>Bob: hi
  loop Every minute
    Bob->>Alice: ping`,
      )?.likelyCauses,
    ).toEqual(["A block is missing an `end` statement."]);
  });

  it("suggests quoting labels with parentheses in them", () => {
    expect(
      getMermaidSyntaxErrorGuidance(
        `Parse error on line 2:
  A[Process (main)] --> B
------------^
Expecting 'SQE', 'UNICODE_TEXT', 'TEXT', 'TAGSTART', got 'PS'`,
        `flowchart TD
  A[Process (main)] --> B`,
      )?.likelyCauses,
    ).toEqual([
      'A label contains brackets or parentheses: wrap it in double quotes, e.g. `A["Label (detail)"]`.',
    ]);
  });

  it("explains invalid directions", () => {
    const message = "Parse error on line 2:\n  direction LR\n----^";
    expect(
      getMermaidSyntaxErrorGuidance(
        message,
        "sequenceDiagram\n  direction LR\n  Alice->>Bob: hi",
      )?.likelyCauses,
    ).toContain("Sequence diagrams have no `direction`.");
    expect(
      getMermaidSyntaxErrorGuidance(
        message,
        "flowchart lr\n  subgraph A\n    direction TD\n  end",
      )?.likelyCauses,
    ).toEqual([
      "The flowchart's direction must be `TB` (or `TD`), `BT`, `RL` or `LR`.",
      "A subgraph's `direction` must be `TB`, `BT`, `RL` or `LR`.",
    ]);
  });

  it("explains directions on the first line", () => {
    const message = "Parse error on line 1:\nclassDiagram LR\n-------------^";
    expect(
      getMermaidSyntaxErrorGuidance(message, "classDiagram LR\n  A <|-- B")
        ?.likelyCauses,
    ).toContain(
      "The diagram's direction goes on the next line, as a `direction` statement: e.g. `direction LR`.",
    );
    expect(
      getMermaidSyntaxErrorGuidance(
        message,
        "sequenceDiagram LR\n  Alice->>Bob: hi",
      )?.likelyCauses,
    ).toContain("Sequence diagrams have no `direction`.");
  });

  it("explains unknown diagram types, as Mermaid and Pele word them", () => {
    for (const message of [
      "No diagram type detected matching given configuration for text: flowchar TD",
      "No diagram type detected for the given text.",
    ]) {
      expect(
        getMermaidSyntaxErrorGuidance(message, "flowchar TD\n  A --> B"),
      ).toEqual({
        summary: "Unknown diagram type.",
        likelyCauses: [expect.stringContaining("`flowchart TD`")],
      });
    }
  });
});

describe("getMermaidDiagramType", () => {
  it("reads the diagram type past comments, directives and front matter", () => {
    expect(
      getMermaidDiagramType(`---
title: Example
---
%%{init: {"theme": "dark"}}%%
%% a comment

sequenceDiagram
  Alice->>Bob: hi`),
    ).toBe("sequence");
    expect(getMermaidDiagramType("graph LR\n  A --> B")).toBe("flowchart");
    expect(getMermaidDiagramType("stateDiagram-v2\n  [*] --> A")).toBe("state");
    expect(getMermaidDiagramType('pie\n  "A": 1')).toBeNull();
  });
});

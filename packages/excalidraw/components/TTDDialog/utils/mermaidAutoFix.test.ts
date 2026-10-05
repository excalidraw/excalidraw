import { describe, expect, it } from "vitest";

import { getMermaidAutoFixCandidates } from "./mermaidAutoFix";

describe("getMermaidAutoFixCandidates", () => {
  it("suggests removing trailing token after a closed label shape", () => {
    const sourceText = `graph TD
  L3_TCP["TCP (Transmission Control Protocol)"]x
  L3_UDP["UDP (User Datagram Protocol)"]`;

    const errorMessage = `Parse error on line 2:
...ission Control Protocol)"]x
-----------------------------^
Expecting 'SEMI', got 'NODE_STRING'`;

    const candidates = getMermaidAutoFixCandidates(sourceText, errorMessage);

    expect(candidates).toContain(`graph TD
  L3_TCP["TCP (Transmission Control Protocol)"]
  L3_UDP["UDP (User Datagram Protocol)"]`);
  });

  it("suggests appending missing end statements", () => {
    const sourceText = `graph TD
subgraph A
  A1[Start]`;

    const errorMessage = `Parse error on line 3:
... A1[Start]
-------------^
Expecting 'end'`;

    const candidates = getMermaidAutoFixCandidates(sourceText, errorMessage);

    expect(candidates).toContain(`graph TD
subgraph A
  A1[Start]
end`);
  });

  it("returns empty list for non-parse errors", () => {
    expect(
      getMermaidAutoFixCandidates("graph TD\nA-->B", "Network error"),
    ).toEqual([]);
  });

  it("extracts line index from lexical error format too", () => {
    const sourceText = `graph TD
  subgraph Layers["X"]x
  direction TB`;

    const errorMessage = `Lexical error on line 2. Unrecognized text.
...  subgraph Layers["X"]x        direction
-----------------------^`;

    const candidates = getMermaidAutoFixCandidates(sourceText, errorMessage);

    expect(candidates).toContain(`graph TD
  subgraph Layers["X"]
  direction TB`);
  });

  it("removes extra > after edge label", () => {
    const sourceText = `flowchart TD
  A["User Input"] -->|text|> B["Tokenization"]
  A["User Input"] -->|text|> B["Tokenization"]`;

    const errorMessage = `Parse error on line 2:
...A["User Input"] -->|text|> B["Tokenization"]
---------------------------^
Expecting 'NODE_STRING', got 'GT'`;

    const candidates = getMermaidAutoFixCandidates(sourceText, errorMessage);

    expect(candidates).toContain(`flowchart TD
  A["User Input"] -->|text| B["Tokenization"]
  A["User Input"] -->|text| B["Tokenization"]`);
  });

  it("suggests removing the last invalid deactivate for participant errors", () => {
    const sourceText = `sequenceDiagram
  participant QAEngineer as QA
  activate QA
  QA->>QA: Verifies Fix
  deactivate QA
  QA->>QA: Verifies Again
  deactivate QA`;

    const errorMessage = "Trying to inactivate an inactive participant (QA)";

    const candidates = getMermaidAutoFixCandidates(sourceText, errorMessage);

    expect(candidates).toContain(`sequenceDiagram
  participant QAEngineer as QA
  activate QA
  QA->>QA: Verifies Fix
  deactivate QA
  QA->>QA: Verifies Again`);
  });

  it("adds a fallback candidate that removes all invalid deactivations", () => {
    const sourceText = `sequenceDiagram
  participant QAEngineer as QA
  deactivate QA
  QA->>QA: Verifies Fix
  deactivate QA`;

    const errorMessage = "Trying to inactivate an inactive participant (QA)";

    const candidates = getMermaidAutoFixCandidates(sourceText, errorMessage);

    expect(candidates).toContain(`sequenceDiagram
  participant QAEngineer as QA
  QA->>QA: Verifies Fix`);
  });
});

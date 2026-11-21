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

  it("quotes node labels with brackets or parentheses in them", () => {
    const sourceText = `flowchart TD
  A[Process (main)] --> B{Valid (yes/no)?}
  B --> C(Retry [x])`;

    const errorMessage = `Parse error on line 2:
  A[Process (main)] --> B{Valid (yes/no)?}
------------^
Expecting 'SQE', 'UNICODE_TEXT', 'TEXT', 'TAGSTART', got 'PS'`;

    expect(getMermaidAutoFixCandidates(sourceText, errorMessage)).toContain(
      `flowchart TD
  A["Process (main)"] --> B{"Valid (yes/no)?"}
  B --> C("Retry [x]")`,
    );
  });

  it("closes a node label left open, before the edge after it", () => {
    const sourceText = `flowchart TD
  A[Start --> B
  B --> C`;

    const errorMessage = `Parse error on line 3:
  B --> C
-------^
Expecting 'SQE', got '$end'`;

    const candidates = getMermaidAutoFixCandidates(sourceText, errorMessage);
    expect(candidates).toContain(`flowchart TD
  A[Start] --> B
  B --> C`);
    // never by emptying the line
    expect(candidates).not.toContain(`flowchart TD\n\n  B --> C`);
    // before closing it at the end of the line
    expect(
      candidates.indexOf(`flowchart TD
  A[Start] --> B
  B --> C`),
    ).toBeLessThan(
      candidates.indexOf(`flowchart TD
  A[Start --> B]
  B --> C`),
    );
  });

  it("drops closing brackets that close nothing", () => {
    expect(
      getMermaidAutoFixCandidates(
        "flowchart TD\n  A --> B]\n  B --> C",
        "Lexical error on line 2. Unrecognized text.\n  A --> B]\n---------^",
      ),
    ).toContain("flowchart TD\n  A --> B\n  B --> C");
  });

  it("turns flowchart and state diagram `->` into `-->`, outside labels", () => {
    const errorMessage = `Parse error on line 2:
  A -> B
----^
Expecting 'SEMI', 'NEWLINE', 'EOF', got 'MINUS'`;

    expect(
      getMermaidAutoFixCandidates(
        `flowchart TD\n  A -> B["x -> y"]\n  B -> C`,
        errorMessage,
      ),
    ).toContain(`flowchart TD\n  A --> B["x -> y"]\n  B --> C`);
    expect(
      getMermaidAutoFixCandidates(
        "stateDiagram-v2\n  [*] -> Idle : go -> stop\n  Idle --> [*]",
        errorMessage,
      ),
    ).toContain("stateDiagram-v2\n  [*] --> Idle : go -> stop\n  Idle --> [*]");
  });

  it("renames `end` used as a flowchart node", () => {
    const sourceText = `flowchart TD
  subgraph S
    A --> end
  end
  end --> B`;

    const errorMessage = `Parse error on line 3:
    A --> end
----------^
Expecting 'NODE_STRING', got 'end'`;

    expect(getMermaidAutoFixCandidates(sourceText, errorMessage)).toContain(
      `flowchart TD
  subgraph S
    A --> End
  end
  End --> B`,
    );
  });

  it("closes unclosed blocks where their indentation ends", () => {
    const sourceText = `classDiagram
  class Animal {
    +int age
  Animal <|-- Duck`;

    const errorMessage = `Parse error on line 4:
  Animal <|-- Duck
------------------^
Expecting 'STRUCT_STOP', got 'EOF_IN_STRUCT'`;

    expect(getMermaidAutoFixCandidates(sourceText, errorMessage)[0]).toBe(
      `classDiagram
  class Animal {
    +int age
  }
  Animal <|-- Duck`,
    );
  });

  it("appends the `end`s of unclosed sequence blocks", () => {
    const sourceText = `sequenceDiagram
  Alice->>Bob: hi
  loop Every minute
    Bob->>Alice: ping`;

    const errorMessage = `Parse error on line 4:
    Bob->>Alice: ping
---------------------^
Expecting 'end', got '$end'`;

    expect(getMermaidAutoFixCandidates(sourceText, errorMessage)).toContain(
      `${sourceText}\n  end`,
    );
  });

  it("adds the colon missing before a message or relationship label", () => {
    expect(
      getMermaidAutoFixCandidates(
        "sequenceDiagram\n  Alice->>Bob hi there\n  Bob->>Alice: ok",
        "Parse error on line 2:\n  Alice->>Bob hi there\n----------------------^\nExpecting 'TXT', got 'NEWLINE'",
      ),
    ).toContain("sequenceDiagram\n  Alice->>Bob: hi there\n  Bob->>Alice: ok");
    expect(
      getMermaidAutoFixCandidates(
        "erDiagram\n  CUSTOMER ||--o{ ORDER places",
        "Parse error on line 2:\n  CUSTOMER ||--o{ ORDER places\n------------------------^\nExpecting 'COLON', got 'UNICODE_TEXT'",
      ),
    ).toContain("erDiagram\n  CUSTOMER ||--o{ ORDER : places");
  });

  it("fixes an invalid flowchart direction", () => {
    expect(
      getMermaidAutoFixCandidates(
        "flowchart XY\n  A --> B",
        "Lexical error on line 1. Unrecognized text.\nflowchart XY\n---------^",
      ),
    ).toContain("flowchart TD\n  A --> B");
  });

  it("fixes flowchart subgraphs' directions, and drops sequence diagrams' ones", () => {
    expect(
      getMermaidAutoFixCandidates(
        `flowchart LR
  subgraph A
    direction lr
    a1 --> a2
  end
  subgraph B
    direction TD
    b1 --> b2
  end
  subgraph C
    direction sideways
    c1 --> c2
  end`,
        "Lexical error on line 3. Unrecognized text.\n    direction lr\n--------------^",
      ),
    ).toContain(`flowchart LR
  subgraph A
    direction LR
    a1 --> a2
  end
  subgraph B
    direction TB
    b1 --> b2
  end
  subgraph C
    c1 --> c2
  end`);
    expect(
      getMermaidAutoFixCandidates(
        "sequenceDiagram\n  direction LR\n  Alice->>Bob: hi",
        "Parse error on line 2:\n  direction LR\n----^",
      ),
    ).toContain("sequenceDiagram\n  Alice->>Bob: hi");
  });

  it("moves a direction off the first line of class, state and ER diagrams", () => {
    const fix = (sourceText: string) =>
      getMermaidAutoFixCandidates(
        sourceText,
        "Parse error on line 1:\nclassDiagram TD\n-------------^",
      );

    expect(fix("classDiagram TD\n    A <|-- B")).toContain(
      "classDiagram\n    direction TB\n    A <|-- B",
    );
    expect(fix("erDiagram direction LR\n  A ||--o{ B : x")).toContain(
      "erDiagram\n  direction LR\n  A ||--o{ B : x",
    );
    // they have one already: theirs, not a second one
    expect(fix("classDiagram TD\n    direction TB\n    A <|-- B")).toContain(
      "classDiagram\n    direction TB\n    A <|-- B",
    );
    expect(
      fix("classDiagram TD\n    direction TB\n    A <|-- B"),
    ).not.toContainEqual(expect.stringMatching(/direction[^]*direction/));
    // a composite state's isn't the diagram's
    expect(
      fix(
        "stateDiagram-v2 direction LR\n  state X {\n    direction TB\n    [*] --> A\n  }",
      ),
    ).toContain(
      "stateDiagram-v2\n  direction LR\n  state X {\n    direction TB\n    [*] --> A\n  }",
    );
    // not a direction
    expect(fix("classDiagram sideways\n  A <|-- B")).toContain(
      "classDiagram\n  A <|-- B",
    );
    // sequence diagrams have none
    expect(fix("sequenceDiagram LR\n  Alice->>Bob: hi")).toContain(
      "sequenceDiagram\n  Alice->>Bob: hi",
    );
  });

  it("fixes a misspelled or missing diagram type", () => {
    const errorMessage = "No diagram type detected for the given text.";

    expect(
      getMermaidAutoFixCandidates("flowchar TD\n  A --> B", errorMessage),
    ).toEqual(["flowchart TD\n  A --> B"]);
    expect(
      getMermaidAutoFixCandidates(
        "%% comment\nsequencediagram\n  Alice->>Bob: hi",
        errorMessage,
      ),
    ).toEqual(["%% comment\nsequenceDiagram\n  Alice->>Bob: hi"]);
    expect(
      getMermaidAutoFixCandidates("A --> B\n  B --> C", errorMessage),
    ).toEqual(["flowchart TD\nA --> B\n  B --> C"]);
    // not anything
    expect(
      getMermaidAutoFixCandidates("gantt\n  title A", errorMessage),
    ).toEqual([]);
  });
});

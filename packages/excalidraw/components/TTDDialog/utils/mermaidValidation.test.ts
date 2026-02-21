import { isValidMermaidSyntax } from "./mermaidValidation";

describe("isValidMermaidSyntax", () => {
  describe("empty and whitespace content", () => {
    it("should return false for empty string", () => {
      expect(isValidMermaidSyntax("")).toBe(false);
    });

    it("should return false for whitespace-only content", () => {
      expect(isValidMermaidSyntax("   ")).toBe(false);
      expect(isValidMermaidSyntax("\n\n")).toBe(false);
      expect(isValidMermaidSyntax("\t\t")).toBe(false);
    });
  });

  describe("balanced brackets, braces, and parentheses", () => {
    it("should return true for content with balanced brackets", () => {
      expect(isValidMermaidSyntax("flowchart LR\nA[Start]")).toBe(true);
      expect(isValidMermaidSyntax("A[Node] --> B[End]")).toBe(true);
      expect(isValidMermaidSyntax("[[nested]]")).toBe(true);
    });

    it("should return true for content with balanced braces", () => {
      expect(isValidMermaidSyntax("graph TD\nA{Decision}")).toBe(true);
      expect(isValidMermaidSyntax("{{nested}}")).toBe(true);
    });

    it("should return true for content with balanced parentheses", () => {
      expect(isValidMermaidSyntax("flowchart LR\nA(Round)")).toBe(true);
      expect(isValidMermaidSyntax("((nested))")).toBe(true);
    });

    it("should return true for content with multiple balanced delimiters", () => {
      expect(isValidMermaidSyntax("A[Node] --> B{Decision} --> C(End)")).toBe(
        true,
      );
      expect(
        isValidMermaidSyntax("flowchart\nA[Start] --> B{Check} --> C(Done)"),
      ).toBe(true);
    });
  });

  describe("unbalanced brackets", () => {
    it("should return false for single unclosed bracket", () => {
      expect(isValidMermaidSyntax("flowchart LR\nA[Start")).toBe(false);
      expect(isValidMermaidSyntax("A[Node")).toBe(false);
    });

    it("should return false for multiple unclosed brackets", () => {
      expect(isValidMermaidSyntax("A[Node\nB[Another")).toBe(false);
      expect(isValidMermaidSyntax("[[[text")).toBe(false);
    });

    it("should return false when closing brackets outnumber opening brackets", () => {
      expect(isValidMermaidSyntax("A]")).toBe(false);
      expect(isValidMermaidSyntax("text]]]")).toBe(false);
    });
  });

  describe("unbalanced braces", () => {
    it("should return false for single unclosed brace", () => {
      expect(isValidMermaidSyntax("graph TD\nA{Decision")).toBe(false);
      expect(isValidMermaidSyntax("A{Node")).toBe(false);
    });

    it("should return false for multiple unclosed braces", () => {
      expect(isValidMermaidSyntax("A{Node\nB{Another")).toBe(false);
      expect(isValidMermaidSyntax("{{{text")).toBe(false);
    });

    it("should return false when closing braces outnumber opening braces", () => {
      expect(isValidMermaidSyntax("A}")).toBe(false);
      expect(isValidMermaidSyntax("text}}}")).toBe(false);
    });
  });

  describe("unbalanced parentheses", () => {
    it("should return false for single unclosed parenthesis", () => {
      expect(isValidMermaidSyntax("flowchart LR\nA(Round")).toBe(false);
      expect(isValidMermaidSyntax("A(Node")).toBe(false);
    });

    it("should return false for multiple unclosed parentheses", () => {
      expect(isValidMermaidSyntax("A(Node\nB(Another")).toBe(false);
      expect(isValidMermaidSyntax("(((text")).toBe(false);
    });

    it("should return false when closing parentheses outnumber opening parentheses", () => {
      expect(isValidMermaidSyntax("A)")).toBe(false);
      expect(isValidMermaidSyntax("text)))")).toBe(false);
    });
  });

  describe("incomplete patterns at end of line", () => {
    it("should return false for arrow patterns", () => {
      expect(isValidMermaidSyntax("A -->")).toBe(false);
      expect(isValidMermaidSyntax("flowchart LR\nA --")).toBe(false);
      expect(isValidMermaidSyntax("B --.")).toBe(false);
      expect(isValidMermaidSyntax("C ==>")).toBe(false);
      expect(isValidMermaidSyntax("D ==")).toBe(false);
      expect(isValidMermaidSyntax("E ~~")).toBe(false);
    });

    it("should return false for colon patterns", () => {
      expect(isValidMermaidSyntax("A::")).toBe(false);
      expect(isValidMermaidSyntax("B:")).toBe(false);
    });

    it("should return false for pipe and ampersand patterns", () => {
      expect(isValidMermaidSyntax("A|")).toBe(false);
      expect(isValidMermaidSyntax("B&")).toBe(false);
    });

    it("should return true when incomplete patterns are not at the end", () => {
      expect(isValidMermaidSyntax("A --> B")).toBe(true);
      expect(isValidMermaidSyntax("A -- text --> B")).toBe(true);
      expect(isValidMermaidSyntax("A: complete")).toBe(true);
      expect(isValidMermaidSyntax("A & B")).toBe(true);
      expect(isValidMermaidSyntax("A | B")).toBe(true);
    });

    it("should only check the last line for incomplete patterns", () => {
      expect(isValidMermaidSyntax("A -->\nB --> C")).toBe(true);
      expect(isValidMermaidSyntax("A:\nB --> C")).toBe(true);
    });
  });

  describe("complex real-world scenarios", () => {
    it("should return true for valid flowchart", () => {
      const mermaid = `flowchart TD
    Start[Start] --> Decision{Is it?}
    Decision -->|Yes| End1[End 1]
    Decision -->|No| End2[End 2]`;
      expect(isValidMermaidSyntax(mermaid)).toBe(true);
    });

    it("should return true for valid sequence diagram", () => {
      const mermaid = `sequenceDiagram
    Alice->>John: Hello John
    John-->>Alice: Great!`;
      expect(isValidMermaidSyntax(mermaid)).toBe(true);
    });

    it("should return false for incomplete flowchart (unclosed bracket)", () => {
      const mermaid = `flowchart TD
    Start[Start --> Decision{Is it?}
    Decision -->|Yes| End[End]`;
      expect(isValidMermaidSyntax(mermaid)).toBe(false);
    });

    it("should return false for flowchart with incomplete arrow at end", () => {
      const mermaid = `flowchart TD
    Start[Start] --> Decision{Is it?}
    Decision -->`;
      expect(isValidMermaidSyntax(mermaid)).toBe(false);
    });

    it("should return true for diagram with multiple node types", () => {
      const mermaid = `graph LR
    A[Square] --> B(Round)
    B --> C{Diamond}
    C --> D[Square]`;
      expect(isValidMermaidSyntax(mermaid)).toBe(true);
    });

    it("should return false for streaming content that is incomplete", () => {
      // Simulates partial AI-generated content during streaming
      expect(isValidMermaidSyntax("flowchart LR\nA[Start] --")).toBe(false);
      expect(isValidMermaidSyntax("flowchart LR\nA[Start")).toBe(false);
      expect(isValidMermaidSyntax("graph TD\nA{Decision")).toBe(false);
    });

    it("should return true for complete multi-line diagram", () => {
      const mermaid = `graph TB
    subgraph one
      a1[First]
    end
    subgraph two
      a2[Second]
    end
    a1 --> a2`;
      expect(isValidMermaidSyntax(mermaid)).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("should handle content with only delimiters", () => {
      expect(isValidMermaidSyntax("[]")).toBe(true);
      expect(isValidMermaidSyntax("{}")).toBe(true);
      expect(isValidMermaidSyntax("()")).toBe(true);
      expect(isValidMermaidSyntax("[")).toBe(false);
      expect(isValidMermaidSyntax("{")).toBe(false);
      expect(isValidMermaidSyntax("(")).toBe(false);
    });

    it("should handle mixed valid and invalid scenarios", () => {
      expect(isValidMermaidSyntax("A[B] -->")).toBe(false);
      expect(isValidMermaidSyntax("A[B --")).toBe(false);
      expect(isValidMermaidSyntax("A{B:")).toBe(false);
    });

    it("should handle strings with special characters", () => {
      expect(isValidMermaidSyntax("A[Node with spaces]")).toBe(true);
      expect(
        isValidMermaidSyntax("A[Node with 'quotes' and numbers 123]"),
      ).toBe(true);
    });

    it("should trim content before validation", () => {
      expect(isValidMermaidSyntax("  A[Node]  \n")).toBe(true);
      expect(isValidMermaidSyntax("\n\nA[Node]\n\n")).toBe(true);
    });
  });
});

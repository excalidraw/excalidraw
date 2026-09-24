export interface Template {
  id: string;
  label: string;
  hint: string;
  placeholder: string;
  /**
   * The mermaid diagram-type directive this template is locked to.
   * enforceHeader.ts uses this to reject/retry generations whose returned
   * mermaid header doesn't match — this is the deterministic type-routing
   * fix, not a hint the model is free to ignore.
   */
  header: string;
  /**
   * Type-specific constraints injected into the generation prompt server-side.
   * Also doubles as the spec a hand-reviewer checks the fallback against.
   */
  rules: string;
  /**
   * Hand-written mermaid source for the no-AI path. Must parse cleanly via
   * parseMermaidToExcalidraw and obey this template's own `rules`.
   */
  fallback: string;
}

// Mind map is deliberately NOT mermaid's native `mindmap` grammar.
// Spike (docs/spike-mermaid.md, 2026-09-20): mermaid-to-excalidraw@2.2.2
// degrades `mindmap` to a single flat embedded image (uneditable). A
// flowchart LR radiating from a centre node produces real, editable
// Excalidraw elements instead, so mind map reuses the flowchart pipeline
// under a stricter topology rule rather than a separate code path.

export const templates: Template[] = [
  {
    id: "flowchart",
    label: "Flowchart",
    hint: "Steps and decisions",
    placeholder: "e.g. 'user signup flow with email verification'",
    header: "flowchart TD",
    rules:
      "Diagram type is flowchart TD (top-down). Use diamond nodes only for " +
      "actual branching decisions with labeled Yes/No (or similar) edges. " +
      "Every other node is a rectangle. Keep node labels short (under 5 " +
      "words). No sub-flows, no swimlanes, no styling directives.",
    fallback: `flowchart TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Do the thing]
    B -->|No| D[Do the other thing]
    C --> E[End]
    D --> E`,
  },
  {
    id: "process",
    label: "Process",
    hint: "A linear sequence of steps",
    placeholder: "e.g. 'order fulfillment from checkout to delivery'",
    header: "flowchart LR",
    rules:
      "Diagram type is flowchart LR (left-to-right). Strictly linear: no " +
      "decision diamonds, no branching, no cycles. Every node is a " +
      "rectangle representing one step, connected in a single unbroken " +
      "chain from first step to last.",
    fallback: `flowchart LR
    A[Step one] --> B[Step two]
    B --> C[Step three]
    C --> D[Step four]`,
  },
  {
    id: "org",
    label: "Org chart",
    hint: "Reporting hierarchy",
    placeholder: "e.g. 'engineering org under the VP of Eng'",
    header: "flowchart TD",
    rules:
      "Diagram type is flowchart TD (top-down). Strict tree: every node " +
      "has exactly one parent (except the root), no cross-links between " +
      "branches, no cycles. Rectangle nodes hold a role or name. Children " +
      "of the same parent are peers, not sequential steps.",
    fallback: `flowchart TD
    A[Root] --> B[Direct report 1]
    A --> C[Direct report 2]
    B --> D[Direct report 1a]`,
  },
  {
    id: "mindmap",
    label: "Mind map",
    hint: "Ideas radiating from one centre",
    placeholder: "e.g. 'launch checklist for the Q3 release'",
    header: "flowchart LR",
    rules:
      "Diagram type is flowchart LR, used as a mind map: a single centre " +
      "node (drawn as a circle, e.g. Root((Central Idea))) with every " +
      "branch node connected directly to the centre — a star topology, " +
      "not a chain. Do not connect branch nodes to each other. Do not use " +
      "mermaid's `mindmap` diagram type.",
    fallback: `flowchart LR
    Root((Central idea)) --> A[Branch one]
    Root --> B[Branch two]
    Root --> C[Branch three]`,
  },
];

export function getTemplate(id: string): Template | undefined {
  return templates.find((t) => t.id === id);
}

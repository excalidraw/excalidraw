import { describe, expect, it } from "vitest";

import {
  indexKey,
  layout,
  MermaidSyntaxError,
  mermaidToElements,
  parseFlowchart,
  UnsupportedDiagramError,
} from "../src/diagram/mermaid";

describe("parseFlowchart", () => {
  it("parses nodes, shapes, labels and chains", () => {
    const g = parseFlowchart(`graph TD
      A[Start] --> B{Is it valid?}
      B -->|Yes| C(Save)
      B -- No --> D((Reject))
      C --> E([Done]) --> F[[Sub]]`);
    expect(g.dir).toBe("TD");
    expect([...g.nodes.values()].map((n) => [n.id, n.label, n.shape])).toEqual([
      ["A", "Start", "rect"],
      ["B", "Is it valid?", "diamond"],
      ["C", "Save", "round"],
      ["D", "Reject", "ellipse"],
      ["E", "Done", "stadium"],
      ["F", "Sub", "rect"],
    ]);
    expect(g.edges.map((e) => [e.from, e.to, e.label])).toEqual([
      ["A", "B", ""],
      ["B", "C", "Yes"],
      ["B", "D", "No"],
      ["C", "E", ""],
      ["E", "F", ""],
    ]);
  });

  it("understands link styles, both-way arrows, multiple targets and semicolons", () => {
    const g = parseFlowchart(
      "flowchart LR\nA -.-> B; B ==> C\nC --- D\nA & B --> E\nD <--> F",
    );
    expect(g.dir).toBe("LR");
    const by = (f: string, t: string) =>
      g.edges.find((e) => e.from === f && e.to === t)!;
    expect(by("A", "B").style).toBe("dashed");
    expect(by("B", "C").style).toBe("thick");
    expect(by("C", "D").arrow).toBe(false);
    expect(by("A", "E")).toBeTruthy();
    expect(by("B", "E")).toBeTruthy();
    expect(by("D", "F").bothWays).toBe(true);
  });

  it("ignores comments, styling, subgraphs and cleans labels", () => {
    const g = parseFlowchart(`graph TB
      %% a comment
      subgraph one
        A["Quoted <b>bold</b><br/>two lines"] --> B
      end
      classDef foo fill:#f9f
      style A fill:#fff
      click A callback`);
    expect(g.dir).toBe("TD");
    expect(g.nodes.get("A")!.label).toBe("Quoted bold\ntwo lines");
    expect(g.edges).toHaveLength(1);
  });

  it("reports unsupported diagram types and syntax errors distinctly", () => {
    expect(() => parseFlowchart("sequenceDiagram\nA->>B: hi")).toThrow(
      UnsupportedDiagramError,
    );
    expect(() => parseFlowchart("hello world")).toThrow(MermaidSyntaxError);
    expect(() => parseFlowchart("graph TD\n")).toThrow(MermaidSyntaxError);
    expect(() => parseFlowchart("graph TD\nA --> ")).toThrow(
      MermaidSyntaxError,
    );
  });

  it("caps the number of nodes", () => {
    const src = `graph TD\n${Array.from(
      { length: 400 },
      (_, i) => `N${i} --> N${i + 1}`,
    ).join("\n")}`;
    expect(() => parseFlowchart(src)).toThrow(/Too many nodes/);
  });
});

describe("layout", () => {
  const overlap = (a: any, b: any) =>
    a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

  it("ranks top-down without overlaps, including cycles and self loops", () => {
    const g = parseFlowchart(
      "graph TD\nA --> B\nA --> C\nB --> D\nC --> D\nD --> A\nD --> D",
    );
    const p = [...layout(g).values()];
    const rankY = (id: string) => p.find((n) => n.id === id)!.y;
    expect(rankY("A")).toBeLessThan(rankY("B"));
    expect(rankY("B")).toBe(rankY("C"));
    expect(rankY("B")).toBeLessThan(rankY("D"));
    for (let i = 0; i < p.length; i++) {
      for (let j = i + 1; j < p.length; j++) {
        expect(overlap(p[i], p[j])).toBe(false);
      }
    }
  });

  it("supports LR, RL and BT directions", () => {
    const at = (dir: string) => {
      const m = layout(parseFlowchart(`graph ${dir}\nA --> B`));
      return [m.get("A")!, m.get("B")!];
    };
    const [a1, b1] = at("LR");
    expect(a1!.x).toBeLessThan(b1!.x);
    const [a2, b2] = at("RL");
    expect(a2!.x).toBeGreaterThan(b2!.x);
    const [a3, b3] = at("BT");
    expect(a3!.y).toBeGreaterThan(b3!.y);
  });
});

describe("mermaidToElements", () => {
  const conv = () =>
    mermaidToElements("graph TD\nA[Start] -->|go| B{Ok?}\nB --> C((End))", {
      idPrefix: "t",
      origin: { x: 100, y: 200 },
    });

  it("emits consistent bound elements: text in containers, arrows bound both ways", () => {
    const { elements, nodeCount, edgeCount } = conv();
    expect([nodeCount, edgeCount]).toEqual([3, 2]);
    const byId = new Map(elements.map((e) => [e.id, e]));
    expect(byId.size).toBe(elements.length); // unique ids
    for (const el of elements) {
      for (const b of el.boundElements ?? []) {
        const target = byId.get(b.id)!;
        expect(target, `bound element ${b.id}`).toBeTruthy();
        if (target.type === "text") {
          expect(target.containerId).toBe(el.id);
        }
      }
      if (el.type === "arrow") {
        for (const bind of [el.startBinding, el.endBinding]) {
          const shape = byId.get(bind.elementId)!;
          expect(
            shape.boundElements.some(
              (b: any) => b.id === el.id && b.type === "arrow",
            ),
          ).toBe(true);
        }
      }
    }
    expect(
      elements
        .filter((e) => e.type === "text")
        .map((e) => e.text)
        .sort(),
    ).toEqual(["End", "Ok?", "Start", "go"]);
  });

  it("honours origin, shapes and arrow geometry", () => {
    const { elements, bounds } = conv();
    expect(bounds.x).toBeGreaterThanOrEqual(100 - 200);
    expect(elements.find((e) => e.id === "t-n-B")!.type).toBe("diamond");
    expect(elements.find((e) => e.id === "t-n-C")!.type).toBe("ellipse");
    const arrow = elements.find((e) => e.id === "t-e-0")!;
    expect(arrow.points).toHaveLength(2);
    expect(arrow.endArrowhead).toBe("arrow");
    // the arrow starts on A's border, below A's centre for a top-down graph
    const a = elements.find((e) => e.id === "t-n-A")!;
    expect(arrow.y).toBeGreaterThanOrEqual(a.y + a.height - 1);
  });

  it("assigns strictly increasing fractional indexes", () => {
    const { elements } = conv();
    const idx = elements.map((e) => e.index);
    expect([...idx].sort()).toEqual(idx);
    expect(new Set(idx).size).toBe(idx.length);
    const keys = Array.from({ length: 5000 }, (_, i) => indexKey(i));
    expect([...keys].sort()).toEqual(keys);
    expect(indexKey(0)).toBe("a0");
    expect(indexKey(62)).toBe("b00");
  });

  it("is deterministic for the same input and seed", () => {
    const strip = (r: ReturnType<typeof conv>) =>
      JSON.stringify(r.elements.map(({ updated, ...rest }: any) => rest));
    expect(strip(conv())).toBe(strip(conv()));
  });
});

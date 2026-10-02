import { describe, expect, it } from "vitest";

import { MermaidStreamFilter, toMermaidSource } from "../src/ai/mermaidStream";

const run = (chunks: string[]) => {
  const f = new MermaidStreamFilter();
  let out = "";
  for (const c of chunks) {
    out += f.push(c);
  }
  out += f.end();
  return out;
};

/** Every way of splitting a string must give the same result. */
const splits = (s: string) => [
  [s],
  s.split(""),
  s.match(/.{1,3}/gs)!,
  s.match(/.{1,7}/gs)!,
  [s.slice(0, Math.floor(s.length / 2)), s.slice(Math.floor(s.length / 2))],
];

describe("MermaidStreamFilter", () => {
  const diagram = "flowchart TD\n  A[Start] --> B[End]";

  it("strips fences and surrounding prose, whatever the chunking", () => {
    const replies = [
      `\`\`\`mermaid\n${diagram}\n\`\`\``,
      `\`\`\`mermaid\n${diagram}\n\`\`\`\nHere is your diagram.`,
      `Sure! Here you go:\n\n\`\`\`mermaid\n${diagram}\n\`\`\`\nHope it helps`,
      `\`\`\`\n${diagram}\n\`\`\``,
      `\`\`\`Mermaid \r\n${diagram.replace(/\n/g, "\r\n")}\r\n\`\`\``,
    ];
    for (const r of replies) {
      for (const chunks of splits(r)) {
        expect(run(chunks).replace(/\r/g, "")).toBe(diagram);
      }
    }
  });

  it("passes bare diagrams through, even after a chatty first line", () => {
    for (const chunks of splits(diagram)) {
      expect(run(chunks)).toBe(diagram);
    }
    for (const chunks of splits(`Here you go\n${diagram}`)) {
      expect(run(chunks)).toBe(diagram);
    }
  });

  it("does not leak backticks inside a diagram or a partial closing fence", () => {
    const withTicks = 'flowchart TD\n  A["use `code`"] --> B';
    // a single/double backtick inside the body must survive; only ``` ends the block
    expect(run(splits(`\`\`\`mermaid\n${withTicks}\n\`\`\``)[1]!)).toBe(
      withTicks,
    );
    expect(run(["```mermaid\n", "flowchart TD\nA-->B\n`", "``"])).toBe(
      "flowchart TD\nA-->B",
    );
  });

  it("emits nothing for replies without a diagram", () => {
    expect(run(["I'm sorry, ", "I can't help with that."])).toBe("");
    const f = new MermaidStreamFilter();
    f.push("nope");
    f.end();
    expect(f.hasOutput).toBe(false);
  });

  it("streams incrementally (does not wait for the end)", () => {
    const f = new MermaidStreamFilter();
    expect(f.push("```mermaid\nflowchart TD\n")).toBe("flowchart TD");
    expect(f.push("  A --> B\n")).toBe("\n  A --> B");
    expect(f.push("```\ntrailing")).toBe("");
    expect(f.end()).toBe("");
  });

  it("supports other diagram types and toMermaidSource", () => {
    const seq = "sequenceDiagram\n  A->>B: hi";
    expect(toMermaidSource(`\`\`\`mermaid\n${seq}\n\`\`\``)).toBe(seq);
    expect(toMermaidSource("no diagram")).toBeNull();
  });
});

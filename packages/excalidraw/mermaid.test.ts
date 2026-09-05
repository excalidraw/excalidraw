import type { ExcalidrawElementSkeleton } from "@excalidraw/element";

import {
  isMaybeMermaidDefinition,
  normalizeMermaidLineBreaks,
} from "./mermaid";

describe("isMaybeMermaidDefinition", () => {
  it("should return true for a valid mermaid definition", () => {
    expect(isMaybeMermaidDefinition("flowchart")).toBe(true);
    expect(isMaybeMermaidDefinition("flowchart LR")).toBe(true);
    expect(isMaybeMermaidDefinition("flowchart LR\nola")).toBe(true);
    expect(isMaybeMermaidDefinition("%%{}%%flowchart")).toBe(true);
    expect(isMaybeMermaidDefinition("%%{}%% flowchart")).toBe(true);

    expect(isMaybeMermaidDefinition("graphs")).toBe(false);
    expect(isMaybeMermaidDefinition("this flowchart")).toBe(false);
    expect(isMaybeMermaidDefinition("this\nflowchart")).toBe(false);
  });
});

describe("normalizeMermaidLineBreaks", () => {
  it("should convert html line breaks in container labels", () => {
    const elements = [
      {
        type: "rectangle",
        x: 0,
        y: 0,
        label: { text: "A<br/>B<br>C<BR />D", fontSize: 20 },
      },
    ] as ExcalidrawElementSkeleton[];

    expect(normalizeMermaidLineBreaks(elements)).toEqual([
      {
        type: "rectangle",
        x: 0,
        y: 0,
        label: { text: "A\nB\nC\nD", fontSize: 20 },
      },
    ]);
  });

  it("should convert html line breaks in text elements and arrow labels", () => {
    const elements = [
      { type: "text", x: 0, y: 0, text: "A<br/>B" },
      { type: "arrow", x: 0, y: 0, label: { text: "yes<br />no" } },
    ] as ExcalidrawElementSkeleton[];

    expect(normalizeMermaidLineBreaks(elements)).toEqual([
      { type: "text", x: 0, y: 0, text: "A\nB" },
      { type: "arrow", x: 0, y: 0, label: { text: "yes\nno" } },
    ]);
  });

  it("should leave elements without html line breaks untouched", () => {
    const elements = [
      { type: "text", x: 0, y: 0, text: "A" },
      { type: "rectangle", x: 0, y: 0, label: { text: "B" } },
      { type: "ellipse", x: 0, y: 0 },
    ] as ExcalidrawElementSkeleton[];

    const normalized = normalizeMermaidLineBreaks(elements);

    expect(normalized[0]).toBe(elements[0]);
    expect(normalized[1]).toBe(elements[1]);
    expect(normalized[2]).toBe(elements[2]);
  });
});

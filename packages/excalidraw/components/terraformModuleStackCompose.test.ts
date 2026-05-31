import { describe, expect, it } from "vitest";

import { newTextElement } from "@excalidraw/element";

import { composeStackModuleScenes } from "./terraformModuleStackCompose";

describe("composeStackModuleScenes", () => {
  it("places two stack slices side-by-side with stack frames", () => {
    const a = newTextElement({
      text: "a",
      x: 0,
      y: 0,
      customData: { nodePath: "stack-a::r.a" },
    });
    const b = newTextElement({
      text: "b",
      x: 0,
      y: 0,
      customData: { nodePath: "stack-b::r.b" },
    });
    const elements = composeStackModuleScenes([
      { stackId: "stack-a", elements: [a] },
      { stackId: "stack-b", elements: [b] },
    ]);

    const frames = elements.filter((el) => el.type === "frame");
    expect(frames).toHaveLength(2);
    expect(frames.map((f) => (f as { name?: string }).name).sort()).toEqual([
      "stack-a",
      "stack-b",
    ]);

    const bounds = frames.map((f) => f.x + f.width);
    expect(bounds[0]).not.toBe(bounds[1]);
    expect(Math.max(...bounds)).toBeGreaterThan(Math.min(...bounds));
  });
});

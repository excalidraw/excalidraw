import { render } from "../../../../tests/test-utils";
import { API } from "../../../../tests/helpers/api";
import { Excalidraw } from "../../../../packages/excalidraw/index";

import { measureTextElement } from "../../../textElement";
import { ensureSubtypesLoaded } from "../../";

describe("mathjax", () => {
  it("text-only measurements match", async () => {
    await render(<Excalidraw />);
    await ensureSubtypesLoaded(["math"]);
    const text = "A quick brown fox jumps over the lazy dog.";
    const elements = [
      API.createElement({ type: "text", id: "A", text, subtype: "math" }),
      API.createElement({ type: "text", id: "B", text }),
    ];
    const metrics1 = measureTextElement(elements[0]);
    const metrics2 = measureTextElement(elements[1]);
    expect(metrics1).toStrictEqual(metrics2);
  });
  it("minimum height remains", async () => {
    await render(<Excalidraw />);
    await ensureSubtypesLoaded(["math"]);
    const elements = [
      API.createElement({ type: "text", id: "A", text: "a" }),
      API.createElement({
        type: "text",
        id: "B",
        text: "\\(\\alpha\\)",
        subtype: "math",
        customData: { useTex: true },
      }),
      API.createElement({
        type: "text",
        id: "C",
        text: "`beta`",
        subtype: "math",
        customData: { useTex: false },
      }),
    ];
    const height = measureTextElement(elements[0]).height;
    const height1 = measureTextElement(elements[1]).height;
    const height2 = measureTextElement(elements[2]).height;
    expect(height).toEqual(height1);
    expect(height).toEqual(height2);
  });
});

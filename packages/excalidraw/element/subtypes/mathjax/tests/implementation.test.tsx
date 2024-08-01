import { vi } from "vitest";
import { render } from "../../../../tests/test-utils";
import { API } from "../../../../tests/helpers/api";
import { Excalidraw } from "../../../../index";

import { measureTextElement } from "../../../textElement";
import { ensureSubtypesLoaded } from "../../";
import { getMathSubtypeRecord } from "../types";
import { prepareMathSubtype } from "../implementation";

describe("mathjax loaded", () => {
  beforeEach(async () => {
    await render(<Excalidraw />);
    API.addSubtype(getMathSubtypeRecord(), prepareMathSubtype);
    await ensureSubtypesLoaded(["math"]);
  });
  it("text-only measurements match", async () => {
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
  it("converts math to svgs", async () => {
    const svgDim = 42;
    vi.spyOn(SVGElement.prototype, "getBoundingClientRect").mockImplementation(
      () => new DOMRect(0, 0, svgDim, svgDim),
    );
    const elements = [];
    const type = "text";
    const subtype = "math";
    let text = "Math ";
    elements.push(API.createElement({ type, text }));
    text = "Math \\(\\alpha\\)";
    elements.push(
      API.createElement({ type, subtype, text, customData: { useTex: true } }),
    );
    text = "Math `beta`";
    elements.push(
      API.createElement({ type, subtype, text, customData: { useTex: false } }),
    );
    const metrics = {
      width: measureTextElement(elements[0]).width + svgDim,
      height: svgDim,
    };
    expect(measureTextElement(elements[1])).toStrictEqual(metrics);
    expect(measureTextElement(elements[2])).toStrictEqual(metrics);
  });
});

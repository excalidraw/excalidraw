import { render } from "../../../../tests/test-utils";
import { API } from "../../../../tests/helpers/api";
import ExcalidrawApp from "../../../";

import { measureTextElement } from "../../../../element/textElement";
import { ensureSubtypesLoaded } from "../../../../subtypes";

describe("mathjax", () => {
  it("text-only measurements match", async () => {
    await render(<ExcalidrawApp />);
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
});

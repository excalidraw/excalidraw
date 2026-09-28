import { exportToSvg } from "../scene/export";

import { API } from "./helpers/api";

describe("text formatting", () => {
  it("exports a tint and syntax-highlighted fenced sections without source delimiters", async () => {
    const source = ["Before", "```js", "const value = 1;", "```", "After"].join(
      "\n",
    );
    const text = {
      ...API.createElement({
        type: "text",
        text: source,
        backgroundColor: "#ffec99",
      }),
      customData: { textBackground: true },
    };

    const svg = await exportToSvg(
      [text],
      { exportBackground: false, viewBackgroundColor: "#ffffff" },
      {},
    );
    const renderedElement = svg.querySelector(`[data-id="${text.id}"]`);
    const renderedLines = [...renderedElement!.querySelectorAll("text")];

    expect(renderedElement?.querySelector("rect")?.getAttribute("fill")).toBe(
      "#ffec99",
    );
    expect(renderedLines.map((line) => line.textContent)).toEqual([
      "Before",
      "const value = 1;",
      "After",
    ]);
    expect(renderedLines[1].querySelectorAll("tspan").length).toBeGreaterThan(
      1,
    );
    expect(text.originalText).toBe(source);
  });
});

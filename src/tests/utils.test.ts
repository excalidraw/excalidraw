import { API } from "./helpers/api";
import * as utils from "../utils";

describe("Test isTransparent", () => {
  it("should return true when color is rgb transparent", () => {
    expect(utils.isTransparent("#ff00")).toEqual(true);
    expect(utils.isTransparent("#fff00000")).toEqual(true);
    expect(utils.isTransparent("transparent")).toEqual(true);
  });

  it("should return false when color is not transparent", () => {
    expect(utils.isTransparent("#ced4da")).toEqual(false);
  });
});

describe("getLineGroupedRanges", () => {
  it.each([1, 2, 3])(
    "given N lines where N=%i, should return N+1 ranges",
    (numberOfNewLines) => {
      const text = Array.from(
        { length: numberOfNewLines + 1 },
        (_, i) => `line ${i + 1}`,
      ).join("\n");

      expect(
        utils.getLineGroupedRanges(API.createElement({ type: "text", text })),
      ).toHaveLength(numberOfNewLines + 1);
    },
  );

  it("should span color range correctly across newline", () => {
    expect(
      utils.getLineGroupedRanges(
        API.createElement({
          type: "text",
          text: "a\na",
          colorRanges: { 0: "#fff", 1: "#fff" },
          strokeColor: "#000",
        }),
      ),
    ).toEqual<utils.LineGroupedRanges>([
      [{ color: "#fff", text: "a" }],
      [{ color: "#000", text: "a" }],
    ]);
  });

  it("should span color range correctly across carriage return", () => {
    expect(
      utils.getLineGroupedRanges(
        API.createElement({
          type: "text",
          text: "a\r\na",
          colorRanges: { 0: "#fff", 1: "#fff", 2: "#fff" },
          strokeColor: "#000",
        }),
      ),
    ).toEqual<utils.LineGroupedRanges>([
      [{ color: "#fff", text: "a" }],
      [{ color: "#000", text: "a" }],
    ]);
  });

  it.skip("handles multi codepoint unicode", () => {
    expect(
      utils.getLineGroupedRanges(
        API.createElement({
          type: "text",
          text: "🤌🏼👌🏿",
          strokeColor: "#000",
        }),
      ),
    ).toEqual<utils.LineGroupedRanges>([
      [
        { color: "#000", text: "🤌🏼" },
        { color: "#000", text: "👌🏿" },
      ],
    ]);
  });
});

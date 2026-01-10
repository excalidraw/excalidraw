import { describe, expect, it } from "vitest";

import { API } from "@excalidraw/excalidraw/tests/helpers/api";

import { extractElementContext } from "../components/ChatCanvas/useSelectionContext";

describe("extractElementContext", () => {
  it("returns structured context for selected elements", () => {
    const rectangle = API.createElement({
      type: "rectangle",
      id: "rect-1",
      x: 10,
      y: 20,
      width: 120,
      height: 80,
      frameId: "frame-1",
      groupIds: ["group-1"],
      strokeColor: "#111111",
      backgroundColor: "#eeeeee",
      strokeWidth: 2,
    });

    const text = API.createElement({
      type: "text",
      id: "text-1",
      text: "Hello",
      x: 40,
      y: 60,
      width: 140,
      height: 30,
      fontSize: 16,
      fontFamily: 1,
      textAlign: "left",
      frameId: null,
    });

    const result = extractElementContext(
      [rectangle, text],
      ["rect-1", "text-1"],
    );

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      id: "rect-1",
      type: "rectangle",
      x: 10,
      y: 20,
      width: 120,
      height: 80,
      frameId: "frame-1",
      groupIds: ["group-1"],
      strokeColor: "#111111",
      backgroundColor: "#eeeeee",
      strokeWidth: 2,
    });
    expect(result[1]).toMatchObject({
      id: "text-1",
      type: "text",
      text: "Hello",
      fontSize: 16,
      fontFamily: 1,
      textAlign: "left",
    });
  });
});

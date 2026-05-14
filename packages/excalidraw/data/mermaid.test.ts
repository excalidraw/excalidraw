import { describe, expect, it } from "vitest";

import { pointFrom } from "@excalidraw/math";

import { API } from "../tests/helpers/api";

import { serializeExcalidrawToMermaid } from "./mermaid";

describe("serializeExcalidrawToMermaid", () => {
  it("exports bound flowchart nodes and arrows", () => {
    const start = API.createElement({
      id: "start",
      type: "rectangle",
      x: 0,
      y: 0,
      width: 120,
      height: 60,
    });
    const startLabel = API.createElement({
      id: "start-label",
      type: "text",
      text: "Start",
      containerId: start.id,
    });
    const decision = API.createElement({
      id: "decision",
      type: "diamond",
      x: 220,
      y: 0,
      width: 120,
      height: 80,
    });
    const decisionLabel = API.createElement({
      id: "decision-label",
      type: "text",
      text: "Ready?",
      containerId: decision.id,
    });
    const arrow = API.createElement({
      id: "arrow-1",
      type: "arrow",
      x: 120,
      y: 20,
      points: [pointFrom(0, 0), pointFrom(100, 0)],
      startBinding: {
        elementId: start.id,
        fixedPoint: [1, 0.5],
        mode: "inside",
      },
      endBinding: {
        elementId: decision.id,
        fixedPoint: [0, 0.5],
        mode: "inside",
      },
    });
    const arrowLabel = API.createElement({
      id: "arrow-label",
      type: "text",
      text: "yes",
      containerId: arrow.id,
    });

    expect(
      serializeExcalidrawToMermaid([
        start,
        startLabel,
        decision,
        decisionLabel,
        arrow,
        arrowLabel,
      ]),
    ).toEqual(
      `flowchart LR
  N1["Start"]
  N2{"Ready?"}
  N1 -->|yes| N2`,
    );
  });

  it("exports standalone text as rectangle nodes", () => {
    const text = API.createElement({
      id: "note",
      type: "text",
      text: "Loose note",
      x: 40,
      y: 80,
    });

    expect(serializeExcalidrawToMermaid([text])).toEqual(
      `flowchart TD
  N1["Loose note"]`,
    );
  });

  it("rejects unsupported elements", () => {
    const image = API.createElement({
      id: "img",
      type: "image",
      fileId: "file-id",
      status: "saved",
    });

    expect(() => serializeExcalidrawToMermaid([image])).toThrow(
      "Only rectangles, diamonds, ellipses, text, and bound arrows can be exported to Mermaid.",
    );
  });

  it("rejects unbound arrows", () => {
    const start = API.createElement({
      id: "start",
      type: "rectangle",
    });
    const arrow = API.createElement({
      id: "arrow-1",
      type: "arrow",
      x: 0,
      y: 0,
      points: [pointFrom(0, 0), pointFrom(100, 0)],
    });

    expect(() => serializeExcalidrawToMermaid([start, arrow])).toThrow(
      "Only arrows bound to two nodes can be exported to Mermaid.",
    );
  });
});

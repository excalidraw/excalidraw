import React from "react";

import { reseed } from "@excalidraw/common";
import { elementWithCanvasCache } from "@excalidraw/element";
import { pointFrom, type LocalPoint } from "@excalidraw/math";

import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { render, unmountComponent } from "./test-utils";

unmountComponent();

describe("arrow label rendering", () => {
  beforeEach(() => {
    localStorage.clear();
    reseed(7);
  });

  it("composites cached arrowheads outside the label clip", async () => {
    const { container } = await render(<Excalidraw />);
    const canvas: HTMLCanvasElement = container.querySelector("canvas.static")!;
    const context = canvas.getContext("2d") as any;
    window.h.state.width = 1000;
    window.h.state.height = 1000;
    context.__clearEvents();

    const arrow = API.createElement({
      type: "arrow",
      id: "cached-arrow-with-endpoint-label",
      x: 100,
      y: 100,
      width: 200,
      height: 0,
      points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(200, 0)],
      endArrowhead: "triangle",
    });
    const label = {
      ...API.createElement({
        type: "text",
        id: "cached-endpoint-label",
        text: "label",
        width: 50,
        height: 20,
        containerId: arrow.id,
      }),
      labelPosition: 1,
    };

    API.setElements([arrow, label]);
    expect(elementWithCanvasCache.get(arrow)?.isArrowBodyOnly).toBe(false);

    context.__clearEvents();
    API.updateElement(arrow, {
      boundElements: [{ type: "text", id: label.id }],
    });

    expect(elementWithCanvasCache.get(arrow)?.isArrowBodyOnly).toBe(true);

    const events = context.__getEvents();
    expect(
      events.some(
        (event: any) =>
          event.type === "clip" && event.props.fillRule === "evenodd",
      ),
    ).toBe(true);

    const clipIndex = events.findIndex((event: any) => event.type === "clip");
    let depth = 0;
    for (let index = 0; index <= clipIndex; index++) {
      if (events[index].type === "save") {
        depth++;
      } else if (events[index].type === "restore") {
        depth--;
      }
    }

    const clipDepth = depth;
    let clipRestoreIndex = -1;
    for (let index = clipIndex + 1; index < events.length; index++) {
      if (events[index].type === "save") {
        depth++;
      } else if (events[index].type === "restore") {
        depth--;
        if (depth < clipDepth) {
          clipRestoreIndex = index;
          break;
        }
      }
    }

    const labelIndex = events.findIndex(
      (event: any, index: number) =>
        index > clipRestoreIndex && event.type === "drawImage",
    );
    expect(clipRestoreIndex).toBeGreaterThan(clipIndex);
    expect(
      events
        .slice(clipRestoreIndex + 1, labelIndex)
        .some((event: any) => event.type === "stroke"),
    ).toBe(true);
  });
});

import React from "react";

import { resolvablePromise } from "@excalidraw/common";

import { Excalidraw } from "../index";

import { findShapeByKey } from "../components/Tools";

import { Pointer } from "./helpers/ui";
import { act, render } from "./test-utils";

import type { AppClassProperties, ExcalidrawImperativeAPI } from "../types";

describe("setActiveTool()", () => {
  const h = window.h;

  let excalidrawAPI: ExcalidrawImperativeAPI;

  const mouse = new Pointer("mouse");

  beforeEach(async () => {
    const excalidrawAPIPromise = resolvablePromise<ExcalidrawImperativeAPI>();
    await render(
      <Excalidraw
        onExcalidrawAPI={(api) => excalidrawAPIPromise.resolve(api as any)}
      />,
    );
    excalidrawAPI = await excalidrawAPIPromise;
  });

  it("should expose setActiveTool on package API", () => {
    expect(excalidrawAPI.setActiveTool).toBeDefined();
    expect(excalidrawAPI.setActiveTool).toBe(h.app.setActiveTool);
  });

  it("should set the active tool type", async () => {
    expect(h.state.activeTool.type).toBe("selection");
    act(() => {
      excalidrawAPI.setActiveTool({ type: "rectangle" });
    });
    expect(h.state.activeTool.type).toBe("rectangle");

    mouse.down(10, 10);
    mouse.up(20, 20);

    expect(h.state.activeTool.type).toBe("selection");
  });

  it("should support tool locking", async () => {
    expect(h.state.activeTool.type).toBe("selection");
    act(() => {
      excalidrawAPI.setActiveTool({ type: "rectangle", locked: true });
    });
    expect(h.state.activeTool.type).toBe("rectangle");

    mouse.down(10, 10);
    mouse.up(20, 20);

    expect(h.state.activeTool.type).toBe("rectangle");
  });

  it("should set custom tool", async () => {
    expect(h.state.activeTool.type).toBe("selection");
    act(() => {
      excalidrawAPI.setActiveTool({ type: "custom", customType: "comment" });
    });
    expect(h.state.activeTool.type).toBe("custom");
    expect(h.state.activeTool.customType).toBe("comment");
  });
});
describe("findShapeByKey()", () => {
  const appWithPreferredTool = (
    preferredSelectionTool: "selection" | "lasso",
  ) =>
    ({
      state: {
        preferredSelectionTool: {
          type: preferredSelectionTool,
        },
      },
    } as AppClassProperties);

  it("selection shortcuts activate selection when it's preferred", () => {
    const app = appWithPreferredTool("selection");

    expect(findShapeByKey("v", app)).toBe("selection");
    expect(findShapeByKey("1", app)).toBe("selection");
  });

  it("selection shortcuts activate lasso when it's preferred", () => {
    const app = appWithPreferredTool("lasso");

    expect(findShapeByKey("v", app)).toBe("lasso");
    expect(findShapeByKey("1", app)).toBe("lasso");
  });

  it("letter shortcuts are CapsLock-insensitive", () => {
    const app = appWithPreferredTool("selection");

    expect(findShapeByKey("V", app)).toBe("selection");
    expect(findShapeByKey("R", app)).toBe("rectangle");
    expect(findShapeByKey("X", app)).toBe("freedraw");
  });
});

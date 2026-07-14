import React from "react";
import { vi } from "vitest";

import {
  CURSOR_TYPE,
  resolvablePromise,
  updateActiveTool,
} from "@excalidraw/common";

import { Excalidraw } from "../index";

import { findShapeByKey } from "../components/Tools";

import { API } from "./helpers/api";
import { Pointer } from "./helpers/ui";
import { act, fireEvent, GlobalTestState, render } from "./test-utils";

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

describe("props.activeTool (forced tool)", () => {
  const h = window.h;
  const mouse = new Pointer("mouse");

  const queryToolButton = (type: string) =>
    GlobalTestState.renderResult.container.querySelector<HTMLButtonElement>(
      `[data-testid="toolbar-${type}"]`,
    );

  beforeEach(() => {
    mouse.reset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("forces the tool from the first render, implying locked", async () => {
    await render(<Excalidraw activeTool={{ type: "rectangle" }} />);
    expect(h.state.activeTool.type).toBe("rectangle");
    expect(h.state.activeTool.locked).toBe(true);
    // the cursor reflects the forced tool without any pointer interaction
    expect(GlobalTestState.interactiveCanvas.style.cursor).toBe(
      CURSOR_TYPE.CROSSHAIR,
    );

    // drawing doesn't revert to selection (implied lock)
    mouse.down(10, 10);
    mouse.up(20, 20);
    expect(h.state.activeTool.type).toBe("rectangle");
    expect(h.elements.length).toBe(1);
  });

  it("ignores user & API tool switching without side effects", async () => {
    await render(
      <Excalidraw
        activeTool={{ type: "selection" }}
        handleKeyboardGlobally={true}
      />,
    );
    const rect = API.createElement({
      type: "rectangle",
      x: 10,
      y: 10,
      width: 50,
      height: 50,
    });
    API.setElements([rect]);
    API.setAppState({ selectedElementIds: { [rect.id]: true } });

    // the letter shortcut is refused before it can clear the selection
    fireEvent.keyDown(document, { key: "r", code: "KeyR" });
    expect(h.state.activeTool.type).toBe("selection");
    expect(h.state.selectedElementIds).toEqual({ [rect.id]: true });

    // the imperative API is refused as well — the prop is the single owner
    act(() => {
      h.app.setActiveTool({ type: "freedraw" });
    });
    expect(h.state.activeTool.type).toBe("selection");
  });

  it("keeps the tool in sync with prop changes, until unset", async () => {
    await render(<Excalidraw activeTool={{ type: "rectangle" }} />);
    expect(h.state.activeTool.type).toBe("rectangle");

    GlobalTestState.renderResult.rerender(
      <Excalidraw activeTool={{ type: "custom", customType: "comment" }} />,
    );
    expect(h.state.activeTool.type).toBe("custom");
    expect(h.state.activeTool.customType).toBe("comment");

    // customType-only changes are picked up
    GlobalTestState.renderResult.rerender(
      <Excalidraw activeTool={{ type: "custom", customType: "pin" }} />,
    );
    expect(h.state.activeTool.customType).toBe("pin");

    // unset → uncontrolled: the current tool stays, switching works again
    GlobalTestState.renderResult.rerender(<Excalidraw />);
    expect(h.state.activeTool.customType).toBe("pin");
    act(() => {
      h.app.setActiveTool({ type: "freedraw" });
    });
    expect(h.state.activeTool.type).toBe("freedraw");
  });

  it("snaps back when internal flows reset the tool", async () => {
    await render(<Excalidraw activeTool={{ type: "laser" }} />);
    expect(h.state.activeTool.type).toBe("laser");

    // simulate a funnel-bypassing writer (restore on scene load,
    // actionFinalize, ...)
    act(() => {
      API.setAppState({
        activeTool: updateActiveTool(h.state, { type: "selection" }),
      });
    });
    expect(h.state.activeTool.type).toBe("laser");
  });

  it("renders non-forced toolbar buttons disabled and gates the tool lock", async () => {
    await render(
      <Excalidraw
        activeTool={{ type: "rectangle" }}
        handleKeyboardGlobally={true}
      />,
    );

    expect(queryToolButton("rectangle")!.disabled).toBe(false);
    expect(queryToolButton("rectangle")!.getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(queryToolButton("freedraw")!.disabled).toBe(true);
    expect(queryToolButton("eraser")!.disabled).toBe(true);
    expect(queryToolButton("lock")).toBe(null);

    // Q (toggle tool lock) is ignored — the lock state is host-implied
    expect(h.state.activeTool.locked).toBe(true);
    fireEvent.keyDown(document, { key: "q", code: "KeyQ" });
    expect(h.state.activeTool.locked).toBe(true);
    expect(h.state.activeTool.type).toBe("rectangle");
  });

  it("cannot force the image tool", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    await render(<Excalidraw activeTool={{ type: "image" } as any} />);
    expect(h.state.activeTool.type).toBe("selection");
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining(`"image" tool cannot be forced`),
    );
  });

  it("composes with interaction.enabled.tools (presenter → viewer)", async () => {
    await render(
      <Excalidraw
        activeTool={{ type: "laser" }}
        interaction={{ enabled: { tools: { laser: true } } }}
      />,
    );
    // presenter: forced laser while otherwise non-interactive
    expect(h.state.activeTool.type).toBe("laser");
    expect(h.app.isInteractionEnabled()).toBe(false);
    expect(h.app.isToolSupported("laser")).toBe(true);
    // the laser cursor applies without any pointer interaction
    expect(GlobalTestState.interactiveCanvas.style.cursor).toContain("url(");

    // viewer: fully inert, tool resolves to the default selection
    GlobalTestState.renderResult.rerender(
      <Excalidraw activeTool={{ type: "selection" }} interaction={false} />,
    );
    expect(h.state.activeTool.type).toBe("selection");

    // back to presenter
    GlobalTestState.renderResult.rerender(
      <Excalidraw
        activeTool={{ type: "laser" }}
        interaction={{ enabled: { tools: { laser: true } } }}
      />,
    );
    expect(h.state.activeTool.type).toBe("laser");
  });

  it("forcing a non-activatable tool resolves to selection until activatable", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    await render(
      <Excalidraw activeTool={{ type: "laser" }} interaction={false} />,
    );
    expect(h.state.activeTool.type).toBe("selection");
    expect(warnSpy).toHaveBeenCalled();

    // the tool becomes activatable → the forced tool applies
    GlobalTestState.renderResult.rerender(
      <Excalidraw
        activeTool={{ type: "laser" }}
        interaction={{ enabled: { tools: { laser: true } } }}
      />,
    );
    expect(h.state.activeTool.type).toBe("laser");
  });
});

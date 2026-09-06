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

  it("matches shift-bound tools only when shift is held", () => {
    const app = appWithPreferredTool("selection");

    expect(findShapeByKey("X", app, true)).toBe("autoshape");
    expect(findShapeByKey("x", app, true)).toBe("autoshape");
    // Pressing "X" while CapsLock is active (no shift) stays freedraw
    expect(findShapeByKey("X", app, false)).toBe("freedraw");
  });

  it("does not match plain-bound tools when shift is held", () => {
    const app = appWithPreferredTool("selection");

    expect(findShapeByKey("R", app, true)).toBeNull();
    expect(findShapeByKey("V", app, true)).toBeNull();
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

  it("forces the tool from the first render, behaving as locked", async () => {
    await render(<Excalidraw activeTool={{ type: "rectangle" }} />);
    expect(h.state.activeTool.type).toBe("rectangle");
    // forcing behaves as locked without mutating the user's padlock state
    expect(h.state.activeTool.locked).toBe(false);
    // the cursor reflects the forced tool without any pointer interaction
    expect(GlobalTestState.interactiveCanvas.style.cursor).toBe(
      CURSOR_TYPE.CROSSHAIR,
    );

    // drawing doesn't revert to selection, and the drawn element isn't
    // auto-selected (locked-tool behavior)
    mouse.down(10, 10);
    mouse.up(20, 20);
    expect(h.state.activeTool.type).toBe("rectangle");
    expect(h.elements.length).toBe(1);
    expect(h.state.selectedElementIds).toEqual({});
  });

  it("does not clobber the user's padlock preference", async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);

    // user locks the tool (Q)
    fireEvent.keyDown(document, { key: "q", code: "KeyQ" });
    expect(h.state.activeTool.locked).toBe(true);

    // forcing & unforcing leaves the preference alone
    GlobalTestState.renderResult.rerender(
      <Excalidraw
        activeTool={{ type: "freedraw" }}
        handleKeyboardGlobally={true}
      />,
    );
    expect(h.state.activeTool.type).toBe("freedraw");
    expect(h.state.activeTool.locked).toBe(true);

    GlobalTestState.renderResult.rerender(
      <Excalidraw handleKeyboardGlobally={true} />,
    );
    expect(h.state.activeTool.locked).toBe(true);
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

    // the extra-tools dropdown items are disabled as well
    fireEvent.click(
      GlobalTestState.renderResult.container.querySelector(
        ".App-toolbar__extra-tools-trigger",
      )!,
    );
    const frameItem = document.querySelector<HTMLButtonElement>(
      '[data-testid="toolbar-frame"]',
    );
    expect(frameItem).not.toBe(null);
    expect(frameItem!.disabled).toBe(true);
    const laserItem = document.querySelector<HTMLButtonElement>(
      '[data-testid="toolbar-laser"]',
    );
    expect(laserItem!.disabled).toBe(true);

    // Q (toggle tool lock) is ignored — locking is implied while forced
    expect(h.state.activeTool.locked).toBe(false);
    fireEvent.keyDown(document, { key: "q", code: "KeyQ" });
    expect(h.state.activeTool.locked).toBe(false);
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

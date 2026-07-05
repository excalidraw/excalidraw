import React from "react";
import { vi } from "vitest";

import { CODES, CURSOR_TYPE } from "@excalidraw/common";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import { actionZoomIn } from "../actions/actionCanvas";
import { createPasteEvent, serializeAsClipboardJSON } from "../clipboard";
import { Excalidraw, MainMenu } from "../index";

import { API } from "./helpers/api";
import { Keyboard, Pointer, UI } from "./helpers/ui";
import {
  act,
  fireEvent,
  GlobalTestState,
  mockBoundingClientRect,
  render,
  restoreOriginalGetBoundingClientRect,
  waitFor,
} from "./test-utils";

import type { MockInstance } from "vitest";

import type { ExcalidrawProps } from "../types";

const { h } = window;

const mouse = new Pointer("mouse");

const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(() => resolve(null), ms));

// the wheel listener is attached natively on the excalidraw container
// (not via React), so we dispatch a bubbling wheel event from the canvas
const wheelZoom = () => {
  fireEvent.wheel(GlobalTestState.interactiveCanvas, {
    ctrlKey: true,
    deltaY: -100,
  });
};

const wheelPan = () => {
  fireEvent.wheel(GlobalTestState.interactiveCanvas, {
    deltaX: 30,
    deltaY: 40,
  });
};

// zoom shortcuts' keyTest matches on `event.code` (CODES.EQUAL/MINUS/ZERO)
const pressZoomShortcut = (code: string) => {
  Keyboard.withModifierKeys({ ctrl: true }, () => {
    Keyboard.codePress(code);
  });
};

const rightClickCanvas = () => {
  fireEvent.contextMenu(GlobalTestState.interactiveCanvas, {
    button: 2,
    clientX: 5,
    clientY: 5,
  });
};

const dispatchPaste = async () => {
  const clipboardJSON = await serializeAsClipboardJSON({
    elements: [API.createElement({ type: "rectangle", width: 10, height: 10 })],
    files: null,
  });
  document.dispatchEvent(
    createPasteEvent({ types: { "text/plain": clipboardJSON } }),
  );
};

const queryContainer = (selector: string) =>
  GlobalTestState.renderResult.container.querySelector(selector);

beforeEach(() => {
  localStorage.clear();
  mouse.reset();
});

describe("baseline (interactive & ui enabled by default)", () => {
  beforeEach(async () => {
    mockBoundingClientRect();
    await render(<Excalidraw autoFocus={true} handleKeyboardGlobally={true} />);
    await waitFor(() => expect(h.state.width).toBe(200));
    Object.assign(document, {
      elementFromPoint: () => GlobalTestState.canvas,
    });
  });

  afterEach(() => {
    restoreOriginalGetBoundingClientRect();
  });

  it("user input mechanisms used in this suite actually affect the editor", async () => {
    expect(h.state.viewModeEnabled).toBe(false);

    // ctrl+wheel zooms
    const initialZoom = h.state.zoom.value;
    wheelZoom();
    expect(h.state.zoom.value).toBeGreaterThan(initialZoom);

    // plain wheel pans
    const { scrollX, scrollY } = h.state;
    wheelPan();
    expect([h.state.scrollX, h.state.scrollY]).not.toEqual([scrollX, scrollY]);

    // ctrl+"=" zooms in
    const zoomBeforeKeyboard = h.state.zoom.value;
    pressZoomShortcut(CODES.EQUAL);
    expect(h.state.zoom.value).toBeGreaterThan(zoomBeforeKeyboard);

    // paste inserts elements
    await dispatchPaste();
    await waitFor(() => expect(h.elements.length).toBe(1));

    // right-click opens the context menu
    rightClickCanvas();
    expect(h.state.contextMenu).not.toBe(null);
    expect(UI.queryContextMenu()).not.toBe(null);
  });

  it("renders UI chrome", () => {
    expect(queryContainer(".layer-ui__wrapper")).not.toBe(null);
    expect(queryContainer(".App-toolbar")).not.toBe(null);
    expect(queryContainer(".excalidraw--non-interactive")).toBe(null);
    expect(queryContainer(".excalidraw--ui-hidden")).toBe(null);
  });
});

describe("interaction={false}", () => {
  let rectangle: ExcalidrawElement;

  beforeEach(async () => {
    mockBoundingClientRect();
    rectangle = API.createElement({
      type: "rectangle",
      x: 10,
      y: 10,
      width: 50,
      height: 50,
    });
    await render(
      <Excalidraw
        interaction={false}
        autoFocus={true}
        handleKeyboardGlobally={true}
        initialData={{ elements: [rectangle] }}
      />,
    );
    await waitFor(() => expect(h.state.width).toBe(200));
    Object.assign(document, {
      elementFromPoint: () => GlobalTestState.canvas,
    });
  });

  afterEach(() => {
    restoreOriginalGetBoundingClientRect();
  });

  it("forces viewModeEnabled", () => {
    expect(h.state.viewModeEnabled).toBe(true);
  });

  it("container gets the excalidraw--non-interactive class", () => {
    const container = queryContainer(".excalidraw-container")!;
    expect(container).not.toBe(null);
    expect(container.classList.contains("excalidraw--non-interactive")).toBe(
      true,
    );
  });

  it("wheel does not zoom or pan", () => {
    const { scrollX, scrollY } = h.state;
    const zoom = h.state.zoom.value;

    wheelZoom();
    expect(h.state.zoom.value).toBe(zoom);

    wheelPan();
    expect(h.state.scrollX).toBe(scrollX);
    expect(h.state.scrollY).toBe(scrollY);
  });

  it("keyboard zoom shortcuts are inert", () => {
    // zoom to != 100% first so ctrl+0 (reset zoom) would be observable
    act(() => {
      h.app.actionManager.executeAction(actionZoomIn, "api");
    });
    const zoom = h.state.zoom.value;
    expect(zoom).not.toBe(1);

    pressZoomShortcut(CODES.EQUAL);
    expect(h.state.zoom.value).toBe(zoom);

    pressZoomShortcut(CODES.MINUS);
    expect(h.state.zoom.value).toBe(zoom);

    pressZoomShortcut(CODES.ZERO);
    expect(h.state.zoom.value).toBe(zoom);
  });

  it("pointer down+drag neither selects nor pans", () => {
    const { scrollX, scrollY } = h.state;

    // drag starting on top of the rectangle
    mouse.downAt(30, 30);
    mouse.moveTo(80, 80);
    mouse.upAt(80, 80);

    expect(h.state.selectedElementIds).toEqual({});
    expect(h.state.scrollX).toBe(scrollX);
    expect(h.state.scrollY).toBe(scrollY);

    // plain click on the element doesn't select either
    mouse.reset();
    mouse.clickAt(30, 30);
    expect(h.state.selectedElementIds).toEqual({});
  });

  it("context menu does not open", () => {
    rightClickCanvas();
    expect(h.state.contextMenu).toBe(null);
    expect(UI.queryContextMenu()).toBe(null);
  });

  it("paste is inert", async () => {
    expect(h.elements.length).toBe(1);
    await dispatchPaste();
    // paste is async; give it time to (not) insert
    await act(async () => {
      await sleep(50);
    });
    expect(h.elements.length).toBe(1);
  });

  it("programmatic viewport API still works", () => {
    expect(h.state.zoom.value).toBe(1);

    act(() => {
      h.app.setViewport({
        target: [0, 0, 1000, 1000],
        fit: "scale-down",
        animation: false,
      });
    });

    // 200x100 viewport fitted to a 1000x1000 box
    expect(h.state.zoom.value).toBeCloseTo(0.1);
  });

  it("programmatic updateScene still works", () => {
    expect(h.elements.length).toBe(1);

    const other = API.createElement({
      type: "ellipse",
      x: 100,
      y: 100,
      width: 30,
      height: 30,
    });
    API.updateScene({ elements: [...h.elements, other] });

    expect(h.elements.length).toBe(2);
  });

  it('executeAction no-ops for user sources but works for "api"', () => {
    const zoom = h.state.zoom.value;

    act(() => {
      h.app.actionManager.executeAction(actionZoomIn, "ui");
    });
    expect(h.state.zoom.value).toBe(zoom);

    act(() => {
      h.app.actionManager.executeAction(actionZoomIn, "keyboard");
    });
    expect(h.state.zoom.value).toBe(zoom);

    act(() => {
      h.app.actionManager.executeAction(actionZoomIn, "api");
    });
    expect(h.state.zoom.value).toBeGreaterThan(zoom);
  });

  it("viewModeEnabled cannot be unset while non-interactive", async () => {
    API.updateScene({ appState: { viewModeEnabled: false } });
    await waitFor(() => {
      expect(h.state.viewModeEnabled).toBe(true);
    });
  });
});

describe("toggling `interaction` at runtime", () => {
  afterEach(() => {
    restoreOriginalGetBoundingClientRect();
  });

  it("clears transient state when disabled and re-enables input when re-enabled", async () => {
    mockBoundingClientRect();
    await render(<Excalidraw autoFocus={true} handleKeyboardGlobally={true} />);
    await waitFor(() => expect(h.state.width).toBe(200));

    // draw & select an element, open the context menu
    const rectangle = UI.createElement("rectangle", { x: 10, y: 10, size: 50 });
    expect(h.state.selectedElementIds[rectangle.id]).toBe(true);

    rightClickCanvas();
    expect(h.state.contextMenu).not.toBe(null);

    // flip to non-interactive
    GlobalTestState.renderResult.rerender(
      <Excalidraw
        interaction={false}
        autoFocus={true}
        handleKeyboardGlobally={true}
      />,
    );
    await waitFor(() => {
      expect(h.state.viewModeEnabled).toBe(true);
    });
    expect(h.state.contextMenu).toBe(null);
    expect(h.state.selectedElementIds).toEqual({});

    // input is dead now
    const zoom = h.state.zoom.value;
    wheelZoom();
    expect(h.state.zoom.value).toBe(zoom);

    mouse.reset();
    mouse.clickAt(30, 30);
    expect(h.state.selectedElementIds).toEqual({});

    // flip back to interactive
    GlobalTestState.renderResult.rerender(
      <Excalidraw autoFocus={true} handleKeyboardGlobally={true} />,
    );
    await waitFor(() => {
      expect(h.state.viewModeEnabled).toBe(false);
    });

    // drawing works again
    act(() => {
      h.app.setActiveTool({ type: "rectangle" });
    });
    mouse.reset();
    mouse.downAt(100, 10);
    mouse.moveTo(150, 60);
    mouse.upAt(150, 60);

    expect(h.elements.length).toBe(2);

    // and wheel zoom works again
    wheelZoom();
    expect(h.state.zoom.value).toBeGreaterThan(zoom);
  });
});

describe("ui={false}", () => {
  beforeEach(async () => {
    await render(
      <Excalidraw
        ui={false}
        autoFocus={true}
        handleKeyboardGlobally={true}
        initialData={{
          elements: [
            API.createElement({
              type: "rectangle",
              x: 10,
              y: 10,
              width: 50,
              height: 50,
            }),
          ],
        }}
      >
        {/* children may be functional (e.g. excalidraw.com's <Collab/>),
            so they must mount even with the UI disabled */}
        <div data-testid="host-child" />
        <MainMenu>
          <MainMenu.Item onSelect={() => {}}>menu item</MainMenu.Item>
        </MainMenu>
      </Excalidraw>,
    );
  });

  it("renders canvases but no UI chrome", () => {
    // canvas layers keep rendering
    expect(queryContainer("canvas.static")).not.toBe(null);
    expect(queryContainer("canvas.interactive")).not.toBe(null);
    expect(queryContainer(".SVGLayer")).not.toBe(null);
    expect(queryContainer(".excalidraw-textEditorContainer")).not.toBe(null);

    // no chrome
    expect(queryContainer(".layer-ui__wrapper")).toBe(null);
    expect(queryContainer(".App-toolbar")).toBe(null);
    expect(queryContainer(".App-menu")).toBe(null);
    expect(queryContainer(".layer-ui__wrapper__footer")).toBe(null);
  });

  it("host children still mount, while tunneled UI children don't render", () => {
    // functional children (e.g. collab) keep working
    expect(queryContainer("[data-testid='host-child']")).not.toBe(null);
    // UI children tunnel into outlets that don't exist -> not rendered
    expect(queryContainer(".dropdown-menu")).toBe(null);
    expect(document.querySelector(".dropdown-menu-button")).toBe(null);
  });

  it("container gets the excalidraw--ui-hidden class", () => {
    const container = queryContainer(".excalidraw-container")!;
    expect(container).not.toBe(null);
    expect(container.classList.contains("excalidraw--ui-hidden")).toBe(true);
    // ui-only mode must not force view mode / non-interactivity
    expect(container.classList.contains("excalidraw--non-interactive")).toBe(
      false,
    );
    expect(h.state.viewModeEnabled).toBe(false);
  });

  it("interaction still works (drawing via pointer)", () => {
    expect(h.elements.length).toBe(1);

    act(() => {
      h.app.setActiveTool({ type: "rectangle" });
    });
    mouse.downAt(100, 10);
    mouse.moveTo(150, 60);
    mouse.upAt(150, 60);

    expect(h.elements.length).toBe(2);
    expect(h.elements[1].type).toBe("rectangle");
  });

  it("right-click sets contextMenu state but renders no menu", () => {
    rightClickCanvas();
    expect(h.state.contextMenu).not.toBe(null);
    expect(UI.queryContextMenu()).toBe(null);
  });
});

describe("interaction={false} ui={false}", () => {
  beforeEach(async () => {
    mockBoundingClientRect();
    await render(
      <Excalidraw
        interaction={false}
        ui={false}
        autoFocus={true}
        handleKeyboardGlobally={true}
        initialData={{
          elements: [
            API.createElement({
              type: "rectangle",
              x: 10,
              y: 10,
              width: 50,
              height: 50,
            }),
          ],
        }}
      />,
    );
    await waitFor(() => expect(h.state.width).toBe(200));
  });

  afterEach(() => {
    restoreOriginalGetBoundingClientRect();
  });

  it("renders canvases without chrome and stays fully inert", () => {
    expect(h.state.viewModeEnabled).toBe(true);

    // canvases render, chrome does not
    expect(queryContainer("canvas.static")).not.toBe(null);
    expect(queryContainer("canvas.interactive")).not.toBe(null);
    expect(queryContainer(".layer-ui__wrapper")).toBe(null);
    expect(queryContainer(".App-toolbar")).toBe(null);

    const container = queryContainer(".excalidraw-container")!;
    expect(container.classList.contains("excalidraw--non-interactive")).toBe(
      true,
    );
    expect(container.classList.contains("excalidraw--ui-hidden")).toBe(true);

    // wheel / keyboard / pointer / contextmenu are all no-ops
    const { scrollX, scrollY } = h.state;
    const zoom = h.state.zoom.value;

    wheelZoom();
    wheelPan();
    pressZoomShortcut(CODES.EQUAL);
    expect(h.state.zoom.value).toBe(zoom);
    expect(h.state.scrollX).toBe(scrollX);
    expect(h.state.scrollY).toBe(scrollY);

    mouse.downAt(30, 30);
    mouse.moveTo(80, 80);
    mouse.upAt(80, 80);
    expect(h.state.selectedElementIds).toEqual({});
    expect(h.state.scrollX).toBe(scrollX);
    expect(h.state.scrollY).toBe(scrollY);

    rightClickCanvas();
    expect(h.state.contextMenu).toBe(null);
  });
});

describe("interaction={{ allowed: { links } }}", () => {
  let onLinkOpenSpy: ReturnType<typeof vi.fn>;
  let windowOpenSpy: MockInstance<typeof window.open>;

  // prevent default inside the handler so the editor doesn't call
  // window.open (mocked anyway, defensively)
  const onLinkOpen: NonNullable<ExcalidrawProps["onLinkOpen"]> = (...args) => {
    onLinkOpenSpy(...args);
    args[1].preventDefault();
  };

  beforeEach(() => {
    onLinkOpenSpy = vi.fn();
    windowOpenSpy = vi.spyOn(window, "open").mockReturnValue(null);
  });

  afterEach(() => {
    windowOpenSpy.mockRestore();
  });

  // NOTE `API.createElement` does not propagate `link`, so it's set via
  // `API.updateElement` (same as laser.test.tsx)
  const addRect = (link: string | null = null) => {
    const rect = API.createElement({
      type: "rectangle",
      x: 20,
      y: 20,
      width: 120,
      height: 90,
    });
    API.setElements([rect]);
    if (link) {
      API.updateElement(rect, { link });
    }
    return rect;
  };

  // the link-mode pointerup relies on `hitLinkElement` being set during a
  // preceding pointermove (on non-touchscreen devices), so hover first
  const clickElementCenter = () => {
    mouse.reset();
    mouse.moveTo(80, 65);
    mouse.clickAt(80, 65);
  };

  it("{allowed: {links: true}}: editor is otherwise inert", async () => {
    await render(
      <Excalidraw
        interaction={{ allowed: { links: true } }}
        handleKeyboardGlobally={true}
      />,
    );

    expect(h.app.linksEnabled).toBe(true);
    expect(h.state.viewModeEnabled).toBe(true);
    expect(queryContainer(".excalidraw--non-interactive")).not.toBe(null);

    const zoom = h.state.zoom.value;
    wheelZoom();
    expect(h.state.zoom.value).toBe(zoom);
    pressZoomShortcut(CODES.EQUAL);
    expect(h.state.zoom.value).toBe(zoom);

    rightClickCanvas();
    expect(h.state.contextMenu).toBe(null);
  });

  it("{allowed: {links: true}}: clicking a linked element opens the link", async () => {
    await render(
      <Excalidraw
        interaction={{ allowed: { links: true } }}
        onLinkOpen={onLinkOpen}
      />,
    );
    const linkedRect = addRect("https://excalidraw.com");

    // hovering a linked element shows the pointer cursor (view-mode style:
    // anywhere on the element counts, not just the link icon)
    mouse.reset();
    mouse.moveTo(80, 65);
    expect(GlobalTestState.interactiveCanvas.style.cursor).toBe(
      CURSOR_TYPE.POINTER,
    );

    mouse.clickAt(80, 65);

    expect(onLinkOpenSpy).toHaveBeenCalledTimes(1);
    expect(onLinkOpenSpy.mock.calls[0][0]).toMatchObject({
      id: linkedRect.id,
      link: "https://excalidraw.com",
    });
    // the custom event was defaultPrevented, so no window.open
    expect(windowOpenSpy).not.toHaveBeenCalled();
    // and the click didn't select the element
    expect(h.state.selectedElementIds).toEqual({});
  });

  it("{allowed: {links: true}}: clicking an element without a link does nothing", async () => {
    await render(
      <Excalidraw
        interaction={{ allowed: { links: true } }}
        onLinkOpen={onLinkOpen}
      />,
    );
    addRect(null);

    clickElementCenter();

    expect(onLinkOpenSpy).not.toHaveBeenCalled();
    expect(windowOpenSpy).not.toHaveBeenCalled();
    expect(h.state.selectedElementIds).toEqual({});
  });

  it("{allowed: {links: false}} and {} behave like interaction={false}", async () => {
    await render(
      <Excalidraw
        interaction={{ allowed: { links: false } }}
        onLinkOpen={onLinkOpen}
      />,
    );
    addRect("https://excalidraw.com");

    expect(h.app.linksEnabled).toBe(false);
    expect(h.state.viewModeEnabled).toBe(true);
    expect(queryContainer(".excalidraw--non-interactive")).not.toBe(null);

    clickElementCenter();
    expect(onLinkOpenSpy).not.toHaveBeenCalled();

    // empty object form is equivalent
    GlobalTestState.renderResult.rerender(
      <Excalidraw interaction={{}} onLinkOpen={onLinkOpen} />,
    );
    expect(h.app.linksEnabled).toBe(false);
    expect(h.state.viewModeEnabled).toBe(true);

    clickElementCenter();
    expect(onLinkOpenSpy).not.toHaveBeenCalled();
    expect(windowOpenSpy).not.toHaveBeenCalled();
  });

  it("interaction={false}: links are disabled", async () => {
    await render(<Excalidraw interaction={false} onLinkOpen={onLinkOpen} />);
    addRect("https://excalidraw.com");

    expect(h.app.linksEnabled).toBe(false);

    clickElementCenter();
    expect(onLinkOpenSpy).not.toHaveBeenCalled();
    expect(windowOpenSpy).not.toHaveBeenCalled();
  });

  it("toggling allowed.links false → true at runtime enables link clicks", async () => {
    await render(
      <Excalidraw
        interaction={{ allowed: { links: false } }}
        onLinkOpen={onLinkOpen}
      />,
    );
    const linkedRect = addRect("https://excalidraw.com");

    clickElementCenter();
    expect(onLinkOpenSpy).not.toHaveBeenCalled();

    GlobalTestState.renderResult.rerender(
      <Excalidraw
        interaction={{ allowed: { links: true } }}
        onLinkOpen={onLinkOpen}
      />,
    );
    expect(h.app.linksEnabled).toBe(true);
    // still non-interactive overall
    expect(h.state.viewModeEnabled).toBe(true);

    clickElementCenter();
    expect(onLinkOpenSpy).toHaveBeenCalledTimes(1);
    expect(onLinkOpenSpy.mock.calls[0][0]).toMatchObject({
      id: linkedRect.id,
    });
  });
});

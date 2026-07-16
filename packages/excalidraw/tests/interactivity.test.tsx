import React from "react";
import { vi } from "vitest";

import { CODES, CURSOR_TYPE, POINTER_BUTTON } from "@excalidraw/common";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import { actionZoomIn } from "../actions/actionCanvas";
import { createPasteEvent, serializeAsClipboardJSON } from "../clipboard";
import { DefaultSidebar, Excalidraw, Footer, MainMenu } from "../index";

import { API } from "./helpers/api";
import { Keyboard, Pointer, UI } from "./helpers/ui";
import { getTextEditor, updateTextEditor } from "./queries/dom";
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

    // page-scroll keys are inert as well (navigation-only)
    const { scrollY } = h.state;
    fireEvent.keyDown(document, { key: "PageDown", code: "PageDown" });
    expect(h.state.scrollY).toBe(scrollY);
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
      h.app.viewport.setViewport({
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

describe("browser zoom prevention (non-interactive)", () => {
  // fireEvent returns `false` when a handler called preventDefault()
  const firesCtrlWheel = () =>
    fireEvent.wheel(GlobalTestState.interactiveCanvas, {
      ctrlKey: true,
      deltaY: -100,
    });

  const firesPlainWheel = () =>
    fireEvent.wheel(GlobalTestState.interactiveCanvas, { deltaY: 40 });

  const firesCtrlZoomKey = () =>
    fireEvent.keyDown(document, { ctrlKey: true, code: CODES.EQUAL });

  it("prevents ctrl+wheel & keyboard zoom by default, keeps page scroll", async () => {
    await render(
      <Excalidraw interaction={false} handleKeyboardGlobally={true} />,
    );

    // browser zoom vectors get preventDefault-ed...
    expect(firesCtrlWheel()).toBe(false);
    expect(firesCtrlZoomKey()).toBe(false);
    // ...while regular scroll passes through to the page
    expect(firesPlainWheel()).toBe(true);
    // and the editor itself didn't zoom either
    expect(h.state.zoom.value).toBe(1);
  });

  it("enabled.browserZoom keeps the browser defaults", async () => {
    await render(
      <Excalidraw
        interaction={{ enabled: { browserZoom: true } }}
        handleKeyboardGlobally={true}
      />,
    );

    expect(
      queryContainer(".excalidraw-container")!.classList.contains(
        "excalidraw--allow-browser-zoom",
      ),
    ).toBe(true);

    expect(firesCtrlWheel()).toBe(true);
    expect(firesCtrlZoomKey()).toBe(true);
    expect(firesPlainWheel()).toBe(true);
    expect(h.state.zoom.value).toBe(1);
  });

  it("toggling enabled.browserZoom at runtime re-attaches listeners", async () => {
    await render(
      <Excalidraw interaction={false} handleKeyboardGlobally={true} />,
    );
    expect(firesCtrlWheel()).toBe(false);

    GlobalTestState.renderResult.rerender(
      <Excalidraw
        interaction={{ enabled: { browserZoom: true } }}
        handleKeyboardGlobally={true}
      />,
    );
    expect(firesCtrlWheel()).toBe(true);
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

  it("deselects when disabled while already in view mode", async () => {
    mockBoundingClientRect();
    await render(
      <Excalidraw
        viewModeEnabled={true}
        autoFocus={true}
        handleKeyboardGlobally={true}
      />,
    );
    await waitFor(() => expect(h.state.width).toBe(200));

    const rectangle = API.createElement({ type: "rectangle" });
    API.setElements([rectangle]);
    API.setSelectedElements([rectangle]);
    expect(h.state.selectedElementIds[rectangle.id]).toBe(true);

    GlobalTestState.renderResult.rerender(
      <Excalidraw
        interaction={false}
        viewModeEnabled={true}
        autoFocus={true}
        handleKeyboardGlobally={true}
      />,
    );

    await waitFor(() => {
      expect(h.state.selectedElementIds).toEqual({});
    });
  });

  it("submits an active text editor when interaction is disabled", async () => {
    mockBoundingClientRect();
    await render(<Excalidraw autoFocus={true} handleKeyboardGlobally={true} />);
    await waitFor(() => expect(h.state.width).toBe(200));

    const text = API.createElement({
      type: "text",
      text: "before",
      x: 20,
      y: 20,
    });
    API.setElements([text]);
    API.setSelectedElements([text]);
    Keyboard.keyPress("Enter");

    const editor = await getTextEditor();
    updateTextEditor(editor, "committed before disable");

    GlobalTestState.renderResult.rerender(
      <Excalidraw
        interaction={false}
        autoFocus={true}
        handleKeyboardGlobally={true}
      />,
    );

    await waitFor(() => {
      expect(h.state.editingTextElement).toBe(null);
      expect(queryContainer(".excalidraw-wysiwyg")).toBe(null);
    });
    expect(h.elements.find((element) => element.id === text.id)).toMatchObject({
      originalText: "committed before disable",
    });

    // The detached editor must no longer have a live input listener.
    editor.value = "changed after disable";
    fireEvent.input(editor);
    expect(h.elements.find((element) => element.id === text.id)).toMatchObject({
      originalText: "committed before disable",
    });
  });

  it("commits and closes frame-name editing when interaction is disabled", async () => {
    mockBoundingClientRect();
    await render(<Excalidraw autoFocus={true} handleKeyboardGlobally={true} />);
    await waitFor(() => expect(h.state.width).toBe(200));

    const frame = API.createElement({
      type: "frame",
      x: 20,
      y: 30,
      width: 80,
      height: 50,
    });
    API.setElements([frame]);
    API.updateElement(frame, { name: "before" });
    act(() => h.setState({ editingFrame: frame.id }));

    const frameNameInput = await waitFor(() => {
      const input = queryContainer(".frame-name input");
      expect(input).not.toBe(null);
      return input as HTMLInputElement;
    });
    fireEvent.change(frameNameInput, { target: { value: "  committed  " } });

    GlobalTestState.renderResult.rerender(
      <Excalidraw
        interaction={false}
        autoFocus={true}
        handleKeyboardGlobally={true}
      />,
    );

    await waitFor(() => {
      expect(h.state.editingFrame).toBe(null);
      expect(queryContainer(".frame-name input")).toBe(null);
    });
    expect(h.elements.find((element) => element.id === frame.id)).toMatchObject(
      { name: "committed" },
    );
  });

  it("clears held-key state before interaction is re-enabled", async () => {
    mockBoundingClientRect();
    await render(<Excalidraw autoFocus={true} handleKeyboardGlobally={true} />);
    await waitFor(() => expect(h.state.width).toBe(200));

    // If the keyup occurs while non-interactive, App's keyup listener is not
    // attached. The transition itself must therefore clear this state.
    Keyboard.keyDown(" ");
    GlobalTestState.renderResult.rerender(
      <Excalidraw
        interaction={false}
        autoFocus={true}
        handleKeyboardGlobally={true}
      />,
    );
    await waitFor(() => expect(h.state.viewModeEnabled).toBe(true));
    Keyboard.keyUp(" ");

    GlobalTestState.renderResult.rerender(
      <Excalidraw autoFocus={true} handleKeyboardGlobally={true} />,
    );
    await waitFor(() => expect(h.state.viewModeEnabled).toBe(false));

    act(() => h.app.setActiveTool({ type: "rectangle" }));
    mouse.downAt(20, 20);
    mouse.moveTo(80, 70);
    mouse.upAt(80, 70);
    expect(h.elements).toHaveLength(1);
  });

  it("closes native-listener interaction surfaces when disabled", async () => {
    mockBoundingClientRect();
    await render(<Excalidraw autoFocus={true} handleKeyboardGlobally={true} />);
    await waitFor(() => expect(h.state.width).toBe(200));

    Keyboard.keyPress("i");
    await waitFor(() => {
      expect(queryContainer(".excalidraw-eye-dropper-preview")).not.toBe(null);
    });

    GlobalTestState.renderResult.rerender(
      <Excalidraw
        interaction={false}
        autoFocus={true}
        handleKeyboardGlobally={true}
      />,
    );
    await waitFor(() => {
      expect(queryContainer(".excalidraw-eye-dropper-preview")).toBe(null);
    });
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
            so they must mount even with the default UI disabled */}
        <div data-testid="host-child" />
      </Excalidraw>,
    );
  });

  it("renders canvases but no default UI chrome", () => {
    // canvas layers keep rendering
    expect(queryContainer("canvas.static")).not.toBe(null);
    expect(queryContainer("canvas.interactive")).not.toBe(null);
    expect(queryContainer(".SVGLayer")).not.toBe(null);
    expect(queryContainer(".excalidraw-textEditorContainer")).not.toBe(null);

    // The placement scaffold remains for host UI, but default controls don't.
    expect(queryContainer(".App-toolbar")).toBe(null);
    expect(queryContainer(".dropdown-menu-button")).toBe(null);
    expect(queryContainer(".default-sidebar-trigger")).toBe(null);
    expect(queryContainer(".layer-ui__wrapper__footer-left")).toBe(null);
    expect(queryContainer(".help-icon")).toBe(null);
  });

  it("host children still mount", () => {
    // functional children (e.g. collab) keep working
    expect(queryContainer("[data-testid='host-child']")).not.toBe(null);
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

describe("ui={false} with host UI", () => {
  it("renders host outlets and dialogs invoked by host UI", async () => {
    const { container } = await render(
      <Excalidraw
        ui={false}
        renderTopLeftUI={() => <div data-testid="host-top-left" />}
        renderTopRightUI={() => <div data-testid="host-top-right" />}
      >
        <MainMenu>
          <MainMenu.Item onSelect={() => {}}>host menu item</MainMenu.Item>
          <MainMenu.DefaultItems.SaveAsImage />
        </MainMenu>
        <Footer>
          <div data-testid="host-footer" />
        </Footer>
        <DefaultSidebar.Trigger title="host sidebar" />
      </Excalidraw>,
    );

    expect(queryContainer("[data-testid='host-top-left']")).not.toBe(null);
    expect(queryContainer("[data-testid='host-top-right']")).not.toBe(null);
    expect(queryContainer("[data-testid='host-footer']")).not.toBe(null);
    expect(queryContainer("[aria-label='host sidebar']")).not.toBe(null);

    fireEvent.click(container.querySelector(".dropdown-menu-button")!);
    expect(container.textContent).toContain("host menu item");
    // The internal fallback menu must not be composed.
    expect(queryContainer("[data-testid='load-button']")).toBe(null);

    fireEvent.click(queryContainer("[data-testid='image-export-button']")!);
    await waitFor(() => {
      expect(document.querySelector(".ImageExportModal")).not.toBe(null);
    });
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

    // canvases and host-placement infrastructure render, default chrome does
    // not
    expect(queryContainer("canvas.static")).not.toBe(null);
    expect(queryContainer("canvas.interactive")).not.toBe(null);
    expect(queryContainer(".App-toolbar")).toBe(null);
    expect(queryContainer(".dropdown-menu-button")).toBe(null);

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

describe("interaction={{ enabled: { links } }}", () => {
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

  it("{enabled: {links: true}}: editor is otherwise inert", async () => {
    await render(
      <Excalidraw
        interaction={{ enabled: { links: true } }}
        handleKeyboardGlobally={true}
      />,
    );

    expect(h.app.isLinksEnabled()).toBe(true);
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

  it("{enabled: {links: true}}: clicking a linked element opens the link", async () => {
    await render(
      <Excalidraw
        interaction={{ enabled: { links: true } }}
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

  it("{enabled: {links: true}}: clicking an element without a link does nothing", async () => {
    await render(
      <Excalidraw
        interaction={{ enabled: { links: true } }}
        onLinkOpen={onLinkOpen}
      />,
    );
    addRect(null);

    clickElementCenter();

    expect(onLinkOpenSpy).not.toHaveBeenCalled();
    expect(windowOpenSpy).not.toHaveBeenCalled();
    expect(h.state.selectedElementIds).toEqual({});
  });

  it("{enabled: {links: false}} and {} behave like interaction={false}", async () => {
    await render(
      <Excalidraw
        interaction={{ enabled: { links: false } }}
        onLinkOpen={onLinkOpen}
      />,
    );
    addRect("https://excalidraw.com");

    expect(h.app.isLinksEnabled()).toBe(false);
    expect(h.state.viewModeEnabled).toBe(true);
    expect(queryContainer(".excalidraw--non-interactive")).not.toBe(null);

    clickElementCenter();
    expect(onLinkOpenSpy).not.toHaveBeenCalled();

    // empty object form is equivalent
    GlobalTestState.renderResult.rerender(
      <Excalidraw interaction={{}} onLinkOpen={onLinkOpen} />,
    );
    expect(h.app.isLinksEnabled()).toBe(false);
    expect(h.state.viewModeEnabled).toBe(true);

    clickElementCenter();
    expect(onLinkOpenSpy).not.toHaveBeenCalled();
    expect(windowOpenSpy).not.toHaveBeenCalled();
  });

  it("interaction={false}: links are disabled", async () => {
    await render(<Excalidraw interaction={false} onLinkOpen={onLinkOpen} />);
    addRect("https://excalidraw.com");

    expect(h.app.isLinksEnabled()).toBe(false);

    clickElementCenter();
    expect(onLinkOpenSpy).not.toHaveBeenCalled();
    expect(windowOpenSpy).not.toHaveBeenCalled();
  });

  it("toggling enabled.links false → true at runtime enables link clicks", async () => {
    await render(
      <Excalidraw
        interaction={{ enabled: { links: false } }}
        onLinkOpen={onLinkOpen}
      />,
    );
    const linkedRect = addRect("https://excalidraw.com");

    clickElementCenter();
    expect(onLinkOpenSpy).not.toHaveBeenCalled();

    GlobalTestState.renderResult.rerender(
      <Excalidraw
        interaction={{ enabled: { links: true } }}
        onLinkOpen={onLinkOpen}
      />,
    );
    expect(h.app.isLinksEnabled()).toBe(true);
    // still non-interactive overall
    expect(h.state.viewModeEnabled).toBe(true);

    clickElementCenter();
    expect(onLinkOpenSpy).toHaveBeenCalledTimes(1);
    expect(onLinkOpenSpy.mock.calls[0][0]).toMatchObject({
      id: linkedRect.id,
    });
  });
});

describe("interaction={{ enabled: { navigation } }}", () => {
  beforeEach(async () => {
    mockBoundingClientRect();
    await render(
      <Excalidraw
        interaction={{ enabled: { navigation: true } }}
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

  it("wheel pans & ctrl+wheel zooms the canvas", () => {
    expect(h.app.isNavigationEnabled()).toBe(true);
    expect(h.state.viewModeEnabled).toBe(true);
    expect(queryContainer(".excalidraw--navigation")).not.toBe(null);

    const { scrollX, scrollY } = h.state;
    wheelPan();
    expect([h.state.scrollX, h.state.scrollY]).not.toEqual([scrollX, scrollY]);

    const zoom = h.state.zoom.value;
    wheelZoom();
    expect(h.state.zoom.value).toBeGreaterThan(zoom);
  });

  it("pointer drag pans without selecting", () => {
    // the grab cursor applies from mount (managed imperatively)
    expect(GlobalTestState.interactiveCanvas.style.cursor).toBe(
      CURSOR_TYPE.GRAB,
    );

    const { scrollX, scrollY } = h.state;

    mouse.downAt(80, 80);
    mouse.moveTo(30, 30);
    mouse.upAt(30, 30);

    expect([h.state.scrollX, h.state.scrollY]).not.toEqual([scrollX, scrollY]);
    expect(h.state.selectedElementIds).toEqual({});
  });

  it("supports page-scroll keys (PageUp/PageDown)", () => {
    const { scrollY } = h.state;
    fireEvent.keyDown(document, { key: "PageDown", code: "PageDown" });
    expect(h.state.scrollY).toBeLessThan(scrollY);

    fireEvent.keyDown(document, { key: "PageUp", code: "PageUp" });
    expect(h.state.scrollY).toBe(scrollY);

    // shift scrolls horizontally
    const { scrollX } = h.state;
    fireEvent.keyDown(document, {
      key: "PageDown",
      code: "PageDown",
      shiftKey: true,
    });
    expect(h.state.scrollX).toBeLessThan(scrollX);
    expect(h.state.scrollY).toBe(scrollY);
  });

  it("supports canvas zoom & zoom-to-fit keyboard shortcuts", () => {
    // ctrl+"=" zooms in (and is prevented from zooming the browser)
    const zoom = h.state.zoom.value;
    expect(
      fireEvent.keyDown(document, { ctrlKey: true, code: CODES.EQUAL }),
    ).toBe(false);
    expect(h.state.zoom.value).toBeGreaterThan(zoom);

    // ctrl+"0" resets zoom
    fireEvent.keyDown(document, { ctrlKey: true, code: CODES.ZERO });
    expect(h.state.zoom.value).toBe(1);

    // shift+"1" fits all elements
    const { scrollX, scrollY } = h.state;
    fireEvent.keyDown(document, { shiftKey: true, code: CODES.ONE });
    expect([h.state.scrollX, h.state.scrollY]).not.toEqual([scrollX, scrollY]);
  });

  it("editor is otherwise inert", () => {
    // non-navigation shortcuts stay disabled (e.g. select all)
    fireEvent.keyDown(document, { ctrlKey: true, key: "a", code: "KeyA" });
    expect(h.state.selectedElementIds).toEqual({});

    // no selection, no context menu
    mouse.reset();
    mouse.clickAt(30, 30);
    expect(h.state.selectedElementIds).toEqual({});

    rightClickCanvas();
    expect(h.state.contextMenu).toBe(null);
  });

  it("composes with links", async () => {
    const onLinkOpenSpy = vi.fn();
    const windowOpenSpy = vi.spyOn(window, "open").mockReturnValue(null);

    GlobalTestState.renderResult.rerender(
      <Excalidraw
        interaction={{ enabled: { navigation: true, links: true } }}
        autoFocus={true}
        handleKeyboardGlobally={true}
        onLinkOpen={(...args) => {
          onLinkOpenSpy(...args);
          args[1].preventDefault();
        }}
      />,
    );

    const rect = API.createElement({
      type: "rectangle",
      x: 20,
      y: 20,
      width: 120,
      height: 90,
    });
    API.setElements([rect]);
    API.updateElement(rect, { link: "https://excalidraw.com" });

    mouse.reset();
    mouse.moveTo(80, 65);
    mouse.clickAt(80, 65);

    expect(onLinkOpenSpy).toHaveBeenCalledTimes(1);
    expect(onLinkOpenSpy.mock.calls[0][0]).toMatchObject({ id: rect.id });
    windowOpenSpy.mockRestore();
  });

  it("toggling enabled.navigation at runtime re-attaches listeners", () => {
    GlobalTestState.renderResult.rerender(
      <Excalidraw
        interaction={{ enabled: { navigation: false } }}
        autoFocus={true}
        handleKeyboardGlobally={true}
      />,
    );
    const zoom = h.state.zoom.value;
    wheelZoom();
    expect(h.state.zoom.value).toBe(zoom);

    GlobalTestState.renderResult.rerender(
      <Excalidraw
        interaction={{ enabled: { navigation: true } }}
        autoFocus={true}
        handleKeyboardGlobally={true}
      />,
    );
    wheelZoom();
    expect(h.state.zoom.value).toBeGreaterThan(zoom);
  });
});

describe("interaction={{ enabled: { embeds / interactiveContent } }}", () => {
  beforeEach(() => {
    mockBoundingClientRect();
  });

  afterEach(() => {
    restoreOriginalGetBoundingClientRect();
  });

  const addEmbeddable = () => {
    const embed = API.createElement({
      type: "embeddable",
      x: 20,
      y: 20,
      width: 120,
      height: 90,
    });
    API.setElements([embed]);
    API.updateElement(embed, {
      link: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    });
    return embed;
  };

  it("embeds: hovering & clicking an embeddable activates it", async () => {
    await render(
      <Excalidraw
        interaction={{ enabled: { embeds: true } }}
        validateEmbeddable={true}
      />,
    );
    await waitFor(() => expect(h.state.width).toBe(200));
    const embed = addEmbeddable();

    expect(h.app.isEmbedsEnabled()).toBe(true);
    expect(h.app.isLinksEnabled()).toBe(false);
    expect(queryContainer(".excalidraw--embeds")).not.toBe(null);

    mouse.reset();
    mouse.moveTo(80, 65);
    expect(h.state.activeEmbeddable).toMatchObject({
      element: expect.objectContaining({ id: embed.id }),
      state: "hover",
    });

    mouse.clickAt(80, 65);
    // activation is deferred (see handleIframeLikeCenterClick)
    await waitFor(() => {
      expect(h.state.activeEmbeddable).toMatchObject({ state: "active" });
    });

    // clicking outside deactivates (clicks inside an active embed are
    // consumed by the embed itself)
    mouse.clickAt(5, 5);
    expect(h.state.activeEmbeddable).toBe(null);
  });

  it("without embeds allowed, embeddables stay inert", async () => {
    await render(<Excalidraw interaction={false} validateEmbeddable={true} />);
    await waitFor(() => expect(h.state.width).toBe(200));
    addEmbeddable();

    expect(h.app.isEmbedsEnabled()).toBe(false);
    expect(queryContainer(".excalidraw--embeds")).toBe(null);

    mouse.reset();
    mouse.moveTo(80, 65);
    mouse.clickAt(80, 65);
    expect(h.state.activeEmbeddable).toBe(null);
  });

  it("interactiveContent enables links & embeds together (additive)", async () => {
    await render(
      <Excalidraw interaction={{ enabled: { interactiveContent: true } }} />,
    );
    await waitFor(() => expect(h.state.width).toBe(200));

    expect(h.app.isLinksEnabled()).toBe(true);
    expect(h.app.isEmbedsEnabled()).toBe(true);
    // still non-interactive overall
    expect(h.state.viewModeEnabled).toBe(true);
    expect(h.app.isInteractionEnabled()).toBe(false);

    // additive: explicit false on individual keys doesn't override the
    // umbrella
    GlobalTestState.renderResult.rerender(
      <Excalidraw
        interaction={{
          enabled: { interactiveContent: true, links: false, embeds: false },
        }}
      />,
    );
    expect(h.app.isLinksEnabled()).toBe(true);
    expect(h.app.isEmbedsEnabled()).toBe(true);
  });
});

describe("interaction={{ enabled: { tools } }}", () => {
  const onPointerDownSpy = vi.fn();
  const onPointerUpSpy = vi.fn();
  const onPointerUpdateSpy = vi.fn();

  const renderWithInteraction = async (
    interaction: ExcalidrawProps["interaction"],
  ) => {
    await render(
      <Excalidraw
        interaction={interaction}
        autoFocus={true}
        handleKeyboardGlobally={true}
        onPointerDown={onPointerDownSpy}
        onPointerUp={onPointerUpSpy}
        onPointerUpdate={onPointerUpdateSpy}
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
    Object.assign(document, {
      elementFromPoint: () => GlobalTestState.canvas,
    });
  };

  const rerenderWithInteraction = (
    interaction: ExcalidrawProps["interaction"],
  ) => {
    GlobalTestState.renderResult.rerender(
      <Excalidraw
        interaction={interaction}
        autoFocus={true}
        handleKeyboardGlobally={true}
        onPointerDown={onPointerDownSpy}
        onPointerUp={onPointerUpSpy}
        onPointerUpdate={onPointerUpdateSpy}
      />,
    );
  };

  beforeEach(() => {
    onPointerDownSpy.mockClear();
    onPointerUpSpy.mockClear();
    onPointerUpdateSpy.mockClear();
    mockBoundingClientRect();
  });

  afterEach(() => {
    restoreOriginalGetBoundingClientRect();
  });

  it("laser: pointer strokes draw the laser trail without editing effects", async () => {
    await renderWithInteraction({ enabled: { tools: { laser: true } } });

    act(() => {
      h.app.setActiveTool({ type: "laser" });
    });
    expect(h.app.isToolSupported(h.state.activeTool.type)).toBe(true);
    expect(h.state.viewModeEnabled).toBe(true);
    expect(h.app.isInteractionEnabled()).toBe(false);

    const { scrollX, scrollY } = h.state;

    // stroke starting on top of the rectangle
    mouse.downAt(30, 30);
    expect(h.app.laserTrails.localTrail.hasCurrentTrail).toBe(true);
    expect(onPointerDownSpy).toHaveBeenCalledTimes(1);
    expect(onPointerDownSpy.mock.calls[0][0]).toMatchObject({ type: "laser" });

    mouse.moveTo(80, 80);
    mouse.upAt(80, 80);
    expect(h.app.laserTrails.localTrail.hasCurrentTrail).toBe(false);

    // no selection, no panning, no scene changes
    expect(h.state.selectedElementIds).toEqual({});
    expect([h.state.scrollX, h.state.scrollY]).toEqual([scrollX, scrollY]);
    expect(h.elements.length).toBe(1);
  });

  it("laser: pointer positions broadcast via onPointerUpdate", async () => {
    await renderWithInteraction({ enabled: { tools: { laser: true } } });

    act(() => {
      h.app.setActiveTool({ type: "laser" });
    });

    // between strokes (plain hover)
    mouse.moveTo(50, 50);
    expect(onPointerUpdateSpy).toHaveBeenCalled();
    expect(onPointerUpdateSpy.mock.calls.at(-1)![0].pointer.tool).toBe("laser");

    // during a stroke
    onPointerUpdateSpy.mockClear();
    mouse.downAt(30, 30);
    mouse.moveTo(60, 60);
    mouse.upAt(60, 60);
    expect(
      onPointerUpdateSpy.mock.calls.some(
        ([payload]) => payload.button === "down",
      ),
    ).toBe(true);
    expect(onPointerUpdateSpy.mock.calls.at(-1)![0].button).toBe("up");
  });

  it("custom: onPointerDown/onPointerUp keep dispatching when enabled", async () => {
    await renderWithInteraction({ enabled: { tools: { custom: true } } });

    act(() => {
      h.app.setActiveTool({
        type: "custom",
        customType: "comment",
        locked: true,
      });
    });
    expect(h.app.isToolSupported(h.state.activeTool.type)).toBe(true);

    mouse.downAt(40, 40);
    expect(onPointerDownSpy).toHaveBeenCalledTimes(1);
    expect(onPointerDownSpy.mock.calls[0][0]).toMatchObject({
      type: "custom",
      customType: "comment",
    });

    mouse.upAt(40, 40);
    expect(onPointerUpSpy).toHaveBeenCalledTimes(1);
    expect(onPointerUpSpy.mock.calls[0][0]).toMatchObject({
      type: "custom",
      customType: "comment",
    });

    // tool stays active (activated with `locked: true`), scene untouched
    expect(h.state.activeTool.type).toBe("custom");
    expect(h.state.selectedElementIds).toEqual({});
    expect(h.elements.length).toBe(1);
  });

  it("pointer input stays inert when the active tool is not enabled", async () => {
    await renderWithInteraction({ enabled: { tools: { laser: true } } });

    // default (selection) tool is not in the enabled set
    expect(h.state.activeTool.type).toBe("selection");
    expect(h.app.isToolSupported(h.state.activeTool.type)).toBe(false);

    mouse.downAt(30, 30);
    mouse.moveTo(80, 80);
    mouse.upAt(80, 80);
    expect(h.state.selectedElementIds).toEqual({});
    expect(onPointerDownSpy).not.toHaveBeenCalled();
    expect(onPointerUpdateSpy).not.toHaveBeenCalled();

    // a custom tool isn't covered by `tools.laser` — the switch itself is
    // refused
    act(() => {
      h.app.setActiveTool({
        type: "custom",
        customType: "comment",
        locked: true,
      });
    });
    expect(h.state.activeTool.type).toBe("selection");
    expect(h.app.isToolSupported(h.state.activeTool.type)).toBe(false);
    mouse.reset();
    mouse.downAt(40, 40);
    expect(onPointerDownSpy).not.toHaveBeenCalled();
    expect(h.app.laserTrails.localTrail.hasCurrentTrail).toBe(false);
  });

  it("setActiveTool only activates enabled tools while non-interactive", async () => {
    await renderWithInteraction({ enabled: { tools: { laser: true } } });

    // enabled tool activates
    act(() => {
      h.app.setActiveTool({ type: "laser" });
    });
    expect(h.state.activeTool.type).toBe("laser");

    // tools outside the enabled set are refused
    act(() => {
      h.app.setActiveTool({ type: "rectangle" });
    });
    expect(h.state.activeTool.type).toBe("laser");

    act(() => {
      h.app.setActiveTool({ type: "hand" });
    });
    expect(h.state.activeTool.type).toBe("laser");
  });

  it("active tool resets to selection when it loses its interaction exception", async () => {
    await renderWithInteraction({ enabled: { tools: { laser: true } } });

    act(() => {
      h.app.setActiveTool({ type: "laser" });
    });
    expect(h.state.activeTool.type).toBe("laser");

    // exception removed (e.g. presenter → viewer) → neutral default
    rerenderWithInteraction(false);
    expect(h.state.activeTool.type).toBe("selection");
    expect(queryContainer(".excalidraw--tools")).toBe(null);

    // re-enabling the exception doesn't restore the tool — tool selection
    // stays host-driven
    rerenderWithInteraction({ enabled: { tools: { laser: true } } });
    expect(h.state.activeTool.type).toBe("selection");
  });

  it("interaction={false} refuses tool switching and keeps the laser inert", async () => {
    await renderWithInteraction(false);

    act(() => {
      h.app.setActiveTool({ type: "laser" });
    });
    // the switch is refused — no tool is enabled while fully non-interactive
    expect(h.state.activeTool.type).toBe("selection");
    expect(h.app.isToolSupported(h.state.activeTool.type)).toBe(false);

    mouse.downAt(30, 30);
    mouse.moveTo(80, 80);
    mouse.upAt(80, 80);
    expect(h.app.laserTrails.localTrail.hasCurrentTrail).toBe(false);
    expect(onPointerDownSpy).not.toHaveBeenCalled();
    expect(onPointerUpdateSpy).not.toHaveBeenCalled();
  });

  it("container gets the excalidraw--tools class only while the active tool is enabled", async () => {
    await renderWithInteraction({ enabled: { tools: { laser: true } } });

    // selection active — not in the enabled set
    expect(queryContainer(".excalidraw--tools")).toBe(null);

    act(() => {
      h.app.setActiveTool({ type: "laser" });
    });
    expect(queryContainer(".excalidraw--tools")).not.toBe(null);

    rerenderWithInteraction(false);
    expect(queryContainer(".excalidraw--tools")).toBe(null);
  });

  it("editor is otherwise inert (keyboard, context menu, wheel, eraser button)", async () => {
    await renderWithInteraction({ enabled: { tools: { laser: true } } });

    act(() => {
      h.app.setActiveTool({ type: "laser" });
    });

    // letter shortcuts don't switch tools
    fireEvent.keyDown(document, { key: "r", code: "KeyR" });
    fireEvent.keyDown(document, { key: "v", code: "KeyV" });
    expect(h.state.activeTool.type).toBe("laser");

    // the pen's hardware eraser button doesn't switch tools either
    fireEvent.pointerDown(GlobalTestState.interactiveCanvas, {
      button: POINTER_BUTTON.ERASER,
      clientX: 30,
      clientY: 30,
    });
    expect(h.state.activeTool.type).toBe("laser");
    fireEvent.pointerUp(GlobalTestState.interactiveCanvas, {
      button: POINTER_BUTTON.ERASER,
      clientX: 30,
      clientY: 30,
    });

    rightClickCanvas();
    expect(h.state.contextMenu).toBe(null);

    // wheel stays with the page (no navigation enabled)
    const { scrollX, scrollY } = h.state;
    const zoom = h.state.zoom.value;
    wheelPan();
    wheelZoom();
    expect([h.state.scrollX, h.state.scrollY]).toEqual([scrollX, scrollY]);
    expect(h.state.zoom.value).toBe(zoom);
  });

  it("composes with navigation: drag draws the laser, wheel pans", async () => {
    await renderWithInteraction({
      enabled: { navigation: true, tools: { laser: true } },
    });

    act(() => {
      h.app.setActiveTool({ type: "laser" });
    });

    wheelPan();
    const { scrollX, scrollY } = h.state;
    expect([scrollX, scrollY]).not.toEqual([0, 0]);

    // primary-pointer drag goes to the laser, not panning
    mouse.downAt(30, 30);
    expect(h.app.laserTrails.localTrail.hasCurrentTrail).toBe(true);
    mouse.moveTo(80, 80);
    mouse.upAt(80, 80);
    expect([h.state.scrollX, h.state.scrollY]).toEqual([scrollX, scrollY]);
  });

  it("disabling the tool exception mid-stroke ends the trail", async () => {
    await renderWithInteraction({ enabled: { tools: { laser: true } } });

    act(() => {
      h.app.setActiveTool({ type: "laser" });
    });

    mouse.downAt(30, 30);
    expect(h.app.laserTrails.localTrail.hasCurrentTrail).toBe(true);

    rerenderWithInteraction(false);
    expect(h.app.laserTrails.localTrail.hasCurrentTrail).toBe(false);

    mouse.upAt(30, 30);
    expect(h.app.laserTrails.localTrail.hasCurrentTrail).toBe(false);
  });
});

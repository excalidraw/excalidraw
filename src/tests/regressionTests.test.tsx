import { reseed } from "../random";
import React from "react";
import ReactDOM from "react-dom";
import * as Renderer from "../renderer/renderScene";
import { render, screen, fireEvent } from "./test-utils";
import App from "../components/App";
import { ToolName } from "./queries/toolQueries";
import { KEYS, Key } from "../keys";
import { setDateTimeForTests } from "../utils";
import { ExcalidrawElement } from "../element/types";
import { handlerRectangles } from "../element";

const { h } = window;

const renderScene = jest.spyOn(Renderer, "renderScene");
let getByToolName: (name: string) => HTMLElement = null!;
let canvas: HTMLCanvasElement = null!;

const clickTool = (toolName: ToolName) => {
  fireEvent.click(getByToolName(toolName));
};

let altKey = false;
let shiftKey = false;
let ctrlKey = false;

function withModifierKeys(
  modifiers: { alt?: boolean; shift?: boolean; ctrl?: boolean },
  cb: () => void,
) {
  const prevAltKey = altKey;
  const prevShiftKey = shiftKey;
  const prevCtrlKey = ctrlKey;

  altKey = !!modifiers.alt;
  shiftKey = !!modifiers.shift;
  ctrlKey = !!modifiers.ctrl;

  try {
    cb();
  } finally {
    altKey = prevAltKey;
    shiftKey = prevShiftKey;
    ctrlKey = prevCtrlKey;
  }
}

const hotkeyDown = (hotkey: Key) => {
  const key = KEYS[hotkey];
  if (typeof key !== "string") {
    throw new Error("must provide a hotkey, not a key code");
  }
  keyDown(key);
};

const hotkeyUp = (hotkey: Key) => {
  const key = KEYS[hotkey];
  if (typeof key !== "string") {
    throw new Error("must provide a hotkey, not a key code");
  }
  keyUp(key);
};

const keyDown = (key: string) => {
  fireEvent.keyDown(document, {
    key,
    ctrlKey,
    shiftKey,
    altKey,
    keyCode: key.toUpperCase().charCodeAt(0),
    which: key.toUpperCase().charCodeAt(0),
  });
};

const keyUp = (key: string) => {
  fireEvent.keyUp(document, {
    key,
    ctrlKey,
    shiftKey,
    altKey,
    keyCode: key.toUpperCase().charCodeAt(0),
    which: key.toUpperCase().charCodeAt(0),
  });
};

const hotkeyPress = (key: Key) => {
  hotkeyDown(key);
  hotkeyUp(key);
};

const keyPress = (key: string) => {
  keyDown(key);
  keyUp(key);
};

class Pointer {
  private clientX = 0;
  private clientY = 0;

  constructor(
    private readonly pointerType: "mouse" | "touch" | "pen",
    private readonly pointerId = 1,
  ) {}

  reset() {
    this.clientX = 0;
    this.clientY = 0;
  }

  getPosition() {
    return [this.clientX, this.clientY];
  }

  restorePosition(x = 0, y = 0) {
    this.clientX = x;
    this.clientY = y;
    fireEvent.pointerMove(canvas, this.getEvent());
  }

  private getEvent() {
    return {
      clientX: this.clientX,
      clientY: this.clientY,
      pointerType: this.pointerType,
      pointerId: this.pointerId,
      altKey,
      shiftKey,
      ctrlKey,
    };
  }

  move(dx: number, dy: number) {
    if (dx !== 0 || dy !== 0) {
      this.clientX += dx;
      this.clientY += dy;
      fireEvent.pointerMove(canvas, this.getEvent());
    }
  }

  down(dx = 0, dy = 0) {
    this.move(dx, dy);
    fireEvent.pointerDown(canvas, this.getEvent());
  }

  up(dx = 0, dy = 0) {
    this.move(dx, dy);
    fireEvent.pointerUp(canvas, this.getEvent());
  }

  click(dx = 0, dy = 0) {
    this.down(dx, dy);
    this.up();
  }

  doubleClick(dx = 0, dy = 0) {
    this.move(dx, dy);
    fireEvent.doubleClick(canvas, this.getEvent());
  }
}

const mouse = new Pointer("mouse");
const finger1 = new Pointer("touch", 1);
const finger2 = new Pointer("touch", 2);

const clickLabeledElement = (label: string) => {
  const element = document.querySelector(`[aria-label='${label}']`);
  if (!element) {
    throw new Error(`No labeled element found: ${label}`);
  }
  fireEvent.click(element);
};

const getSelectedElements = (): ExcalidrawElement[] => {
  return h.elements.filter((element) => h.state.selectedElementIds[element.id]);
};

const getSelectedElement = (): ExcalidrawElement => {
  const selectedElements = getSelectedElements();
  if (selectedElements.length !== 1) {
    throw new Error(
      `expected 1 selected element; got ${selectedElements.length}`,
    );
  }
  return selectedElements[0];
};

function getStateHistory() {
  // @ts-ignore
  return h.history.stateHistory;
}

type HandlerRectanglesRet = keyof ReturnType<typeof handlerRectangles>;
const getResizeHandles = (pointerType: "mouse" | "touch" | "pen") => {
  const rects = handlerRectangles(
    getSelectedElement(),
    h.state.zoom,
    pointerType,
  ) as {
    [T in HandlerRectanglesRet]: [number, number, number, number];
  };

  const rv: { [K in keyof typeof rects]: [number, number] } = {} as any;

  for (const handlePos in rects) {
    const [x, y, width, height] = rects[handlePos as keyof typeof rects];

    rv[handlePos as keyof typeof rects] = [x + width / 2, y + height / 2];
  }

  return rv;
};

/**
 * This is always called at the end of your test, so usually you don't need to call it.
 * However, if you have a long test, you might want to call it during the test so it's easier
 * to debug where a test failure came from.
 */
const checkpoint = (name: string) => {
  expect(renderScene.mock.calls.length).toMatchSnapshot(
    `[${name}] number of renders`,
  );
  expect(h.state).toMatchSnapshot(`[${name}] appState`);
  expect(h.history.getSnapshotForTest()).toMatchSnapshot(`[${name}] history`);
  expect(h.elements.length).toMatchSnapshot(`[${name}] number of elements`);
  h.elements.forEach((element, i) =>
    expect(element).toMatchSnapshot(`[${name}] element ${i}`),
  );
};

beforeEach(() => {
  // Unmount ReactDOM from root
  ReactDOM.unmountComponentAtNode(document.getElementById("root")!);

  localStorage.clear();
  renderScene.mockClear();
  h.history.clear();
  reseed(7);
  setDateTimeForTests("201933152653");

  mouse.reset();
  finger1.reset();
  finger2.reset();
  altKey = ctrlKey = shiftKey = false;

  const renderResult = render(<App />);

  getByToolName = renderResult.getByToolName;
  canvas = renderResult.container.querySelector("canvas")!;
});

afterEach(() => {
  checkpoint("end of test");
});

describe("regression tests", () => {
  it("draw every type of shape", () => {
    clickTool("rectangle");
    mouse.down(10, 10);
    mouse.up(10, 10);

    clickTool("diamond");
    mouse.down(10, -10);
    mouse.up(10, 10);

    clickTool("ellipse");
    mouse.down(10, -10);
    mouse.up(10, 10);

    clickTool("arrow");
    mouse.down(10, -10);
    mouse.up(10, 10);

    clickTool("line");
    mouse.down(10, -10);
    mouse.up(10, 10);

    clickTool("arrow");
    mouse.click(10, -10);
    mouse.click(10, 10);
    mouse.click(-10, 10);
    hotkeyPress("ENTER");

    clickTool("line");
    mouse.click(10, -20);
    mouse.click(10, 10);
    mouse.click(-10, 10);
    hotkeyPress("ENTER");

    clickTool("draw");
    mouse.down(10, -20);
    mouse.up(10, 10);

    expect(h.elements.map((element) => element.type)).toEqual([
      "rectangle",
      "diamond",
      "ellipse",
      "arrow",
      "line",
      "arrow",
      "line",
      "draw",
    ]);
  });

  it("click to select a shape", () => {
    clickTool("rectangle");
    mouse.down(10, 10);
    mouse.up(10, 10);

    const firstRectPos = mouse.getPosition();

    clickTool("rectangle");
    mouse.down(10, -10);
    mouse.up(10, 10);

    const prevSelectedId = getSelectedElement().id;
    mouse.restorePosition(...firstRectPos);
    mouse.click();

    expect(getSelectedElement().id).not.toEqual(prevSelectedId);
  });

  for (const [keys, shape] of [
    ["2r", "rectangle"],
    ["3d", "diamond"],
    ["4e", "ellipse"],
    ["5a", "arrow"],
    ["6l", "line"],
    ["7x", "draw"],
  ] as [string, ExcalidrawElement["type"]][]) {
    for (const key of keys) {
      it(`hotkey ${key} selects ${shape} tool`, () => {
        keyPress(key);

        mouse.down(10, 10);
        mouse.up(10, 10);

        expect(getSelectedElement().type).toBe(shape);
      });
    }
  }

  it("change the properties of a shape", () => {
    clickTool("rectangle");
    mouse.down(10, 10);
    mouse.up(10, 10);

    clickLabeledElement("Background");
    clickLabeledElement("#fa5252");
    clickLabeledElement("Stroke");
    clickLabeledElement("#5f3dc4");
    expect(getSelectedElement().backgroundColor).toBe("#fa5252");
    expect(getSelectedElement().strokeColor).toBe("#5f3dc4");
  });

  it("resize an element, trying every resize handle", () => {
    clickTool("rectangle");
    mouse.down(10, 10);
    mouse.up(10, 10);

    const resizeHandles = getResizeHandles("mouse");
    delete resizeHandles.rotation; // exclude rotation handle
    for (const handlePos in resizeHandles) {
      const [x, y] = resizeHandles[handlePos as keyof typeof resizeHandles];
      const { width: prevWidth, height: prevHeight } = getSelectedElement();
      mouse.restorePosition(x, y);
      mouse.down();
      mouse.up(-5, -5);

      const {
        width: nextWidthNegative,
        height: nextHeightNegative,
      } = getSelectedElement();
      expect(
        prevWidth !== nextWidthNegative || prevHeight !== nextHeightNegative,
      ).toBeTruthy();
      checkpoint(`resize handle ${handlePos} (-5, -5)`);

      mouse.down();
      mouse.up(5, 5);

      const { width, height } = getSelectedElement();
      expect(width).toBe(prevWidth);
      expect(height).toBe(prevHeight);
      checkpoint(`unresize handle ${handlePos} (-5, -5)`);

      mouse.restorePosition(x, y);
      mouse.down();
      mouse.up(5, 5);

      const {
        width: nextWidthPositive,
        height: nextHeightPositive,
      } = getSelectedElement();
      expect(
        prevWidth !== nextWidthPositive || prevHeight !== nextHeightPositive,
      ).toBeTruthy();
      checkpoint(`resize handle ${handlePos} (+5, +5)`);

      mouse.down();
      mouse.up(-5, -5);

      const { width: finalWidth, height: finalHeight } = getSelectedElement();
      expect(finalWidth).toBe(prevWidth);
      expect(finalHeight).toBe(prevHeight);

      checkpoint(`unresize handle ${handlePos} (+5, +5)`);
    }
  });

  it("click on an element and drag it", () => {
    clickTool("rectangle");
    mouse.down(10, 10);
    mouse.up(10, 10);

    const { x: prevX, y: prevY } = getSelectedElement();
    mouse.down(-10, -10);
    mouse.up(10, 10);

    const { x: nextX, y: nextY } = getSelectedElement();
    expect(nextX).toBeGreaterThan(prevX);
    expect(nextY).toBeGreaterThan(prevY);

    checkpoint("dragged");

    mouse.down();
    mouse.up(-10, -10);

    const { x, y } = getSelectedElement();
    expect(x).toBe(prevX);
    expect(y).toBe(prevY);
  });

  it("alt-drag duplicates an element", () => {
    clickTool("rectangle");
    mouse.down(10, 10);
    mouse.up(10, 10);

    expect(
      h.elements.filter((element) => element.type === "rectangle").length,
    ).toBe(1);

    withModifierKeys({ alt: true }, () => {
      mouse.down(-10, -10);
      mouse.up(10, 10);
    });

    expect(
      h.elements.filter((element) => element.type === "rectangle").length,
    ).toBe(2);
  });

  it("click-drag to select a group", () => {
    clickTool("rectangle");
    mouse.down(10, 10);
    mouse.up(10, 10);

    clickTool("rectangle");
    mouse.down(10, -10);
    mouse.up(10, 10);

    const finalPosition = mouse.getPosition();

    clickTool("rectangle");
    mouse.down(10, -10);
    mouse.up(10, 10);

    mouse.restorePosition(0, 0);
    mouse.down();
    mouse.restorePosition(...finalPosition);
    mouse.up(5, 5);

    expect(
      h.elements.filter((element) => h.state.selectedElementIds[element.id])
        .length,
    ).toBe(2);
  });

  it("shift-click to multiselect, then drag", () => {
    clickTool("rectangle");
    mouse.down(10, 10);
    mouse.up(10, 10);

    clickTool("rectangle");
    mouse.down(10, -10);
    mouse.up(10, 10);

    const prevRectsXY = h.elements
      .filter((element) => element.type === "rectangle")
      .map((element) => ({ x: element.x, y: element.y }));

    mouse.reset();
    mouse.click(10, 10);
    withModifierKeys({ shift: true }, () => {
      mouse.click(20, 0);
    });

    mouse.down();
    mouse.up(10, 10);

    h.elements
      .filter((element) => element.type === "rectangle")
      .forEach((element, i) => {
        expect(element.x).toBeGreaterThan(prevRectsXY[i].x);
        expect(element.y).toBeGreaterThan(prevRectsXY[i].y);
      });
  });

  it("pinch-to-zoom works", () => {
    expect(h.state.zoom).toBe(1);
    finger1.down(50, 50);
    finger2.down(60, 50);
    finger1.move(-10, 0);
    expect(h.state.zoom).toBeGreaterThan(1);
    const zoomed = h.state.zoom;
    finger1.move(5, 0);
    finger2.move(-5, 0);
    expect(h.state.zoom).toBeLessThan(zoomed);
  });

  it("two-finger scroll works", () => {
    const startScrollY = h.state.scrollY;
    finger1.down(50, 50);
    finger2.down(60, 50);

    finger1.up(0, -10);
    finger2.up(0, -10);
    expect(h.state.scrollY).toBeLessThan(startScrollY);

    const startScrollX = h.state.scrollX;

    finger1.restorePosition(50, 50);
    finger2.restorePosition(50, 60);
    finger1.down();
    finger2.down();
    finger1.up(10, 0);
    finger2.up(10, 0);
    expect(h.state.scrollX).toBeGreaterThan(startScrollX);
  });

  it("spacebar + drag scrolls the canvas", () => {
    const { scrollX: startScrollX, scrollY: startScrollY } = h.state;
    hotkeyDown("SPACE");
    mouse.down(50, 50);
    mouse.up(60, 60);
    hotkeyUp("SPACE");
    const { scrollX, scrollY } = h.state;
    expect(scrollX).not.toEqual(startScrollX);
    expect(scrollY).not.toEqual(startScrollY);
  });

  it("arrow keys", () => {
    clickTool("rectangle");
    mouse.down(10, 10);
    mouse.up(10, 10);
    hotkeyPress("ARROW_LEFT");
    hotkeyPress("ARROW_LEFT");
    hotkeyPress("ARROW_RIGHT");
    hotkeyPress("ARROW_UP");
    hotkeyPress("ARROW_UP");
    hotkeyPress("ARROW_DOWN");
    expect(h.elements[0].x).toBe(9);
    expect(h.elements[0].y).toBe(9);
  });

  it("undo/redo drawing an element", () => {
    clickTool("rectangle");
    mouse.down(10, 10);
    mouse.up(10, 10);

    clickTool("rectangle");
    mouse.down(10, -10);
    mouse.up(10, 10);

    clickTool("arrow");
    mouse.click(10, -10);
    mouse.click(10, 10);
    mouse.click(-10, 10);
    hotkeyPress("ENTER");

    expect(h.elements.filter((element) => !element.isDeleted).length).toBe(3);
    withModifierKeys({ ctrl: true }, () => {
      keyPress("z");
      keyPress("z");
    });
    expect(h.elements.filter((element) => !element.isDeleted).length).toBe(2);
    withModifierKeys({ ctrl: true }, () => {
      keyPress("z");
    });
    expect(h.elements.filter((element) => !element.isDeleted).length).toBe(1);
    withModifierKeys({ ctrl: true, shift: true }, () => {
      keyPress("z");
    });
    expect(h.elements.filter((element) => !element.isDeleted).length).toBe(2);
  });

  it("noop interaction after undo shouldn't create history entry", () => {
    // NOTE: this will fail if this test case is run in isolation. There's
    //  some leaking state or race conditions in initialization/teardown
    //  (couldn't figure out)
    expect(getStateHistory().length).toBe(0);

    clickTool("rectangle");
    mouse.down(10, 10);
    mouse.up(10, 10);

    const firstElementEndPoint = mouse.getPosition();

    clickTool("rectangle");
    mouse.down(10, -10);
    mouse.up(10, 10);

    const secondElementEndPoint = mouse.getPosition();

    expect(getStateHistory().length).toBe(2);

    withModifierKeys({ ctrl: true }, () => {
      keyPress("z");
    });

    expect(getStateHistory().length).toBe(1);

    // clicking an element shouldn't add to history
    mouse.restorePosition(...firstElementEndPoint);
    mouse.click();
    expect(getStateHistory().length).toBe(1);

    withModifierKeys({ shift: true, ctrl: true }, () => {
      keyPress("z");
    });

    expect(getStateHistory().length).toBe(2);

    // clicking an element shouldn't add to history
    mouse.click();
    expect(getStateHistory().length).toBe(2);

    const firstSelectedElementId = getSelectedElement().id;

    // same for clicking the element just redo-ed
    mouse.restorePosition(...secondElementEndPoint);
    mouse.click();
    expect(getStateHistory().length).toBe(2);

    expect(getSelectedElement().id).not.toEqual(firstSelectedElementId);
  });

  it("zoom hotkeys", () => {
    expect(h.state.zoom).toBe(1);
    fireEvent.keyDown(document, { code: "Equal", ctrlKey: true });
    fireEvent.keyUp(document, { code: "Equal", ctrlKey: true });
    expect(h.state.zoom).toBeGreaterThan(1);
    fireEvent.keyDown(document, { code: "Minus", ctrlKey: true });
    fireEvent.keyUp(document, { code: "Minus", ctrlKey: true });
    expect(h.state.zoom).toBe(1);
  });

  it("rerenders UI on language change", () => {
    // select rectangle tool to show properties menu
    clickTool("rectangle");
    // english lang should display `hachure` label
    expect(screen.queryByText(/hachure/i)).not.toBeNull();
    fireEvent.change(document.querySelector(".dropdown-select__language")!, {
      target: { value: "de-DE" },
    });
    // switching to german, `hachure` label should no longer exist
    expect(screen.queryByText(/hachure/i)).toBeNull();
    // reset language
    fireEvent.change(document.querySelector(".dropdown-select__language")!, {
      target: { value: "en" },
    });
  });

  it("make a group and duplicate it", () => {
    clickTool("rectangle");
    mouse.down(10, 10);
    mouse.up(10, 10);

    clickTool("rectangle");
    mouse.down(10, -10);
    mouse.up(10, 10);

    clickTool("rectangle");
    mouse.down(10, -10);
    mouse.up(10, 10);
    const end = mouse.getPosition();

    mouse.reset();
    mouse.down();
    mouse.restorePosition(...end);
    mouse.up();

    expect(h.elements.length).toBe(3);
    for (const element of h.elements) {
      expect(element.groupIds.length).toBe(0);
      expect(h.state.selectedElementIds[element.id]).toBe(true);
    }

    withModifierKeys({ ctrl: true }, () => {
      keyPress("g");
    });

    for (const element of h.elements) {
      expect(element.groupIds.length).toBe(1);
    }

    withModifierKeys({ alt: true }, () => {
      mouse.restorePosition(...end);
      mouse.down();
      mouse.up(10, 10);
    });

    expect(h.elements.length).toBe(6);
    const groups = new Set();
    for (const element of h.elements) {
      for (const groupId of element.groupIds) {
        groups.add(groupId);
      }
    }

    expect(groups.size).toBe(2);
  });

  it("double click to edit a group", () => {
    clickTool("rectangle");
    mouse.down(10, 10);
    mouse.up(10, 10);

    clickTool("rectangle");
    mouse.down(10, -10);
    mouse.up(10, 10);

    clickTool("rectangle");
    mouse.down(10, -10);
    mouse.up(10, 10);

    withModifierKeys({ ctrl: true }, () => {
      keyPress("a");
      keyPress("g");
    });

    expect(getSelectedElements().length).toBe(3);
    expect(h.state.editingGroupId).toBe(null);
    mouse.doubleClick();
    expect(getSelectedElements().length).toBe(1);
    expect(h.state.editingGroupId).not.toBe(null);
  });

  it("adjusts z order when grouping", () => {
    const positions = [];

    clickTool("rectangle");
    mouse.down(10, 10);
    mouse.up(10, 10);
    positions.push(mouse.getPosition());

    clickTool("rectangle");
    mouse.down(10, -10);
    mouse.up(10, 10);
    positions.push(mouse.getPosition());

    clickTool("rectangle");
    mouse.down(10, -10);
    mouse.up(10, 10);
    positions.push(mouse.getPosition());

    const ids = h.elements.map((element) => element.id);

    mouse.restorePosition(...positions[0]);
    mouse.click();
    mouse.restorePosition(...positions[2]);
    withModifierKeys({ shift: true }, () => {
      mouse.click();
    });
    withModifierKeys({ ctrl: true }, () => {
      keyPress("g");
    });

    expect(h.elements.map((element) => element.id)).toEqual([
      ids[1],
      ids[0],
      ids[2],
    ]);
  });

  it("supports nested groups", () => {
    const positions: number[][] = [];

    clickTool("rectangle");
    mouse.down(10, 10);
    mouse.up(10, 10);
    positions.push(mouse.getPosition());

    clickTool("rectangle");
    mouse.down(10, -10);
    mouse.up(10, 10);
    positions.push(mouse.getPosition());

    clickTool("rectangle");
    mouse.down(10, -10);
    mouse.up(10, 10);
    positions.push(mouse.getPosition());

    withModifierKeys({ ctrl: true }, () => {
      keyPress("a");
      keyPress("g");
    });

    mouse.doubleClick();
    withModifierKeys({ shift: true }, () => {
      mouse.restorePosition(...positions[0]);
      mouse.click();
    });
    withModifierKeys({ ctrl: true }, () => {
      keyPress("g");
    });

    const groupIds = h.elements[2].groupIds;
    expect(groupIds.length).toBe(2);
    expect(h.elements[1].groupIds).toEqual(groupIds);
    expect(h.elements[0].groupIds).toEqual(groupIds.slice(1));

    mouse.click(50, 50);
    expect(getSelectedElements().length).toBe(0);
    mouse.restorePosition(...positions[0]);
    mouse.click();
    expect(getSelectedElements().length).toBe(3);
    expect(h.state.editingGroupId).toBe(null);

    mouse.doubleClick();
    expect(getSelectedElements().length).toBe(2);
    expect(h.state.editingGroupId).toBe(groupIds[1]);

    mouse.doubleClick();
    expect(getSelectedElements().length).toBe(1);
    expect(h.state.editingGroupId).toBe(groupIds[0]);

    // click out of the group
    mouse.restorePosition(...positions[1]);
    mouse.click();
    expect(getSelectedElements().length).toBe(0);
    mouse.click();
    expect(getSelectedElements().length).toBe(3);
    mouse.doubleClick();
    expect(getSelectedElements().length).toBe(1);
  });

  it("updates fontSize & fontFamily appState", () => {
    clickTool("text");
    expect(h.state.currentItemFontFamily).toEqual(1); // Virgil
    fireEvent.click(screen.getByText(/code/i));
    expect(h.state.currentItemFontFamily).toEqual(3); // Cascadia
  });

  it("shows context menu for canvas", () => {
    fireEvent.change(document.querySelector(".dropdown-select__language")!, {
      target: { value: "en" },
    });
    fireEvent.contextMenu(canvas, { button: 2, clientX: 1, clientY: 1 });
    const contextMenu = document.querySelector(".context-menu");
    const options = contextMenu?.querySelectorAll(".context-menu-option");
    const expectedOptions = ["Select all"];

    expect(contextMenu).not.toBeNull();
    expect(options?.length).toBe(1);
    expect(options?.item(0).textContent).toBe(expectedOptions[0]);
  });

  it("shows context menu for element", () => {
    fireEvent.change(document.querySelector(".dropdown-select__language")!, {
      target: { value: "en" },
    });
    clickTool("rectangle");
    mouse.down(10, 10);
    mouse.up(20, 20);
    fireEvent.contextMenu(canvas, { button: 2, clientX: 1, clientY: 1 });
    const contextMenu = document.querySelector(".context-menu");
    const options = contextMenu?.querySelectorAll(".context-menu-option");
    const expectedOptions = [
      "Copy styles",
      "Paste styles",
      "Delete",
      "Group selection",
      "Ungroup selection",
      "Send backward",
      "Bring forward",
      "Send to back",
      "Bring to front",
      "Duplicate",
    ];

    expect(contextMenu).not.toBeNull();
    expect(contextMenu?.children.length).toBe(10);
    options?.forEach((opt, i) => {
      expect(opt.textContent).toBe(expectedOptions[i]);
    });
  });
});

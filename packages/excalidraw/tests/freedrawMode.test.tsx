import { POINTER_BUTTON } from "@excalidraw/common";

import type {
  ExcalidrawFreeDrawElement,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";

import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { UI } from "./helpers/ui";
import { act, fireEvent, GlobalTestState, render, screen } from "./test-utils";

const { h } = window;

describe("freedraw mode action", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  afterEach(async () => {
    // https://github.com/floating-ui/floating-ui/issues/1908#issuecomment-1301553793
    await act(async () => {});
  });

  it("applies currentItemStrokeVariability to newly drawn freedraw elements", () => {
    // default app state draws constant-width strokes
    expect(h.state.currentItemStrokeVariability).toBe("constant");

    UI.createElement("freedraw", { x: 0, y: 0 });

    expect(
      (h.elements[0] as ExcalidrawFreeDrawElement).strokeOptions?.variability,
    ).toBe("constant");
    expect(
      (h.elements[0] as ExcalidrawFreeDrawElement).strokeOptions?.streamline,
    ).toBe(0.5);
  });

  it("toggling the radio updates both the selected element and the default", () => {
    const element = UI.createElement("freedraw", { x: 0, y: 0 });
    API.setSelectedElements([element.get()] as NonDeletedExcalidrawElement[]);

    fireEvent.click(screen.getByTitle("Variable"));
    expect(
      (h.elements[0] as ExcalidrawFreeDrawElement).strokeOptions?.variability,
    ).toBe("variable");
    expect(
      (h.elements[0] as ExcalidrawFreeDrawElement).strokeOptions?.streamline,
    ).toBe(0.5);
    expect(h.state.currentItemStrokeVariability).toBe("variable");

    fireEvent.click(screen.getByTitle("Constant"));
    expect(
      (h.elements[0] as ExcalidrawFreeDrawElement).strokeOptions?.variability,
    ).toBe("constant");
    expect(
      (h.elements[0] as ExcalidrawFreeDrawElement).strokeOptions?.streamline,
    ).toBe(0.5);
    expect(h.state.currentItemStrokeVariability).toBe("constant");
  });
});

describe("freedraw pointer recovery", () => {
  beforeEach(async () => {
    await render(<Excalidraw />);
    UI.clickTool("freedraw");
  });

  it.each([
    { button: POINTER_BUTTON.MAIN, buttons: 1 },
    { button: POINTER_BUTTON.WHEEL, buttons: 4 },
  ])("draws after a pen press loses its release ($button)", (firstButton) => {
    const canvas = GlobalTestState.interactiveCanvas;
    const first = {
      pointerId: 40,
      pointerType: "pen",
      isPrimary: true,
      clientX: 30,
      clientY: 30,
      ...firstButton,
    };
    fireEvent.pointerDown(canvas, first);
    if (firstButton.button === POINTER_BUTTON.MAIN) {
      fireEvent.pointerMove(canvas, { ...first, clientX: 40, clientY: 40 });
    }

    // A new primary pen contact arrives with a different ID. The original
    // pointerup never reached the editor.
    const next = {
      ...first,
      pointerId: 41,
      button: POINTER_BUTTON.MAIN,
      buttons: 1,
      clientX: 60,
      clientY: 60,
    };
    const zoom = h.state.zoom;
    const scroll = [h.state.scrollX, h.state.scrollY];
    try {
      fireEvent.pointerDown(canvas, next);
      fireEvent.pointerMove(canvas, { ...next, clientX: 110, clientY: 110 });
      fireEvent.pointerUp(canvas, {
        ...next,
        clientX: 110,
        clientY: 110,
        buttons: 0,
      });

      if (firstButton.button === POINTER_BUTTON.MAIN) {
        expect(h.elements).toHaveLength(2);
        expect(h.elements[0]).toMatchObject({
          type: "freedraw",
          x: 30,
          y: 30,
          width: 10,
          height: 10,
        });
      }
      expect(h.elements.at(-1)).toMatchObject({
        type: "freedraw",
        x: 60,
        y: 60,
        width: 50,
        height: 50,
      });
      expect(h.state.zoom).toEqual(zoom);
      expect([h.state.scrollX, h.state.scrollY]).toEqual(scroll);
    } finally {
      fireEvent.pointerUp(document.body, { ...first, buttons: 0 });
    }
  });

  it("keeps both contacts of a two-finger pinch", () => {
    const canvas = GlobalTestState.interactiveCanvas;
    const first = {
      pointerId: 60,
      pointerType: "touch",
      isPrimary: true,
      clientX: 30,
      clientY: 30,
    };
    const second = { ...first, pointerId: 61, isPrimary: false, clientX: 60 };
    const initialZoom = h.state.zoom.value;

    fireEvent.pointerDown(canvas, first);
    fireEvent.pointerDown(canvas, second);
    try {
      fireEvent.pointerMove(canvas, { ...second, clientX: 90 });
      expect(h.state.zoom.value).toBeGreaterThan(initialZoom);
    } finally {
      fireEvent.pointerUp(canvas, second);
      fireEvent.pointerUp(canvas, first);
    }
  });

  it("draws after the previous pointer was canceled outside the canvas", () => {
    const canvas = GlobalTestState.interactiveCanvas;
    const pen = {
      pointerId: 50,
      pointerType: "pen",
      isPrimary: true,
      button: POINTER_BUTTON.WHEEL,
      buttons: 4,
      clientX: 30,
      clientY: 30,
    };
    fireEvent.pointerDown(canvas, pen);
    fireEvent.pointerCancel(document.body, { ...pen, buttons: 0 });

    // Use a different pointer type so this also exercises cancellation
    // cleanup independently of the next-primary-press recovery.
    const mouse = {
      ...pen,
      pointerId: 1,
      pointerType: "mouse",
      button: POINTER_BUTTON.MAIN,
      buttons: 1,
      clientX: 60,
      clientY: 60,
    };
    const zoom = h.state.zoom;
    const scroll = [h.state.scrollX, h.state.scrollY];
    try {
      fireEvent.pointerMove(canvas, { ...mouse, button: -1, buttons: 0 });
      expect([h.state.scrollX, h.state.scrollY]).toEqual(scroll);

      fireEvent.pointerDown(canvas, mouse);
      fireEvent.pointerMove(canvas, { ...mouse, clientX: 110, clientY: 110 });
      fireEvent.pointerUp(canvas, {
        ...mouse,
        clientX: 110,
        clientY: 110,
        buttons: 0,
      });

      expect(h.elements).toHaveLength(1);
      expect(h.elements[0]).toMatchObject({ type: "freedraw", width: 50 });
      expect(h.state.zoom).toEqual(zoom);
    } finally {
      fireEvent.pointerUp(document.body, { ...pen, buttons: 0 });
    }
  });
});

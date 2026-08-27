import type {
  ExcalidrawFreeDrawElement,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";

import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { Keyboard, Pointer, UI } from "./helpers/ui";
import { act, fireEvent, render, screen } from "./test-utils";

const { h } = window;
const mouse = new Pointer("mouse");

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

  it("ctrl/cmd+click continues the last stroke with a straight segment", () => {
    UI.createElement("freedraw", { x: 0, y: 0, width: 10, height: 10 });

    expect(h.elements.length).toBe(1);
    const firstElement = h.elements[0] as ExcalidrawFreeDrawElement;
    const pointCountBeforeContinuation = firstElement.points.length;

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      mouse.reset();
      mouse.clickAt(200, 200);
    });

    // continues the same element rather than starting a new one
    expect(h.elements.length).toBe(1);

    const continuedElement = h.elements[0] as ExcalidrawFreeDrawElement;
    expect(continuedElement.id).toBe(firstElement.id);

    // the straight segment is densely interpolated (not a single distant
    // point), otherwise perfect-freehand's smoothing undershoots the target
    expect(continuedElement.points.length).toBeGreaterThan(
      pointCountBeforeContinuation + 5,
    );

    const lastPoint =
      continuedElement.points[continuedElement.points.length - 1];
    expect(lastPoint[0] + continuedElement.x).toBeCloseTo(200, 0);
    expect(lastPoint[1] + continuedElement.y).toBeCloseTo(200, 0);
  });

  it("click without ctrl/cmd starts a new stroke instead of continuing", () => {
    UI.createElement("freedraw", { x: 0, y: 0, width: 10, height: 10 });
    expect(h.elements.length).toBe(1);

    mouse.reset();
    mouse.clickAt(200, 200);

    expect(h.elements.length).toBe(2);
  });
});

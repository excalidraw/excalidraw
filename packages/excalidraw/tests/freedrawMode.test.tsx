import type {
  ExcalidrawFreeDrawElement,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";

import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { Keyboard, Pointer, UI } from "./helpers/ui";
import { act, fireEvent, render, screen } from "./test-utils";

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

  it("snaps a Shift-constrained freedraw stroke to a discrete angle", () => {
    UI.clickTool("freedraw");

    const pointer = new Pointer("mouse");
    Keyboard.withModifierKeys({ shift: true }, () => {
      pointer.downAt(100, 100);
      pointer.moveTo(200, 250);

      const liveElement = h.state.newElement as ExcalidrawFreeDrawElement;
      expect(liveElement.points).toHaveLength(2);
      expect(liveElement.points[1][0]).toBeCloseTo(100, 3);
      expect(liveElement.points[1][1]).toBeCloseTo(100 * Math.sqrt(3), 3);

      pointer.upAt(200, 250);
    });

    const element = h.elements[0] as ExcalidrawFreeDrawElement;
    expect(element.points.at(-1)?.[0]).toBeCloseTo(100, 3);
    expect(element.points.at(-1)?.[1]).toBeCloseTo(100 * Math.sqrt(3), 3);
  });

  it("constrains an existing stroke when Shift is pressed at its last point", () => {
    UI.clickTool("freedraw");

    const pointer = new Pointer("mouse");
    pointer.downAt(100, 100);
    pointer.moveTo(130, 130);
    pointer.moveTo(160, 160);

    expect(
      (h.state.newElement as ExcalidrawFreeDrawElement).points,
    ).toHaveLength(3);

    Keyboard.withModifierKeys({ shift: true }, () => {
      pointer.moveTo(160, 160);
    });

    const element = h.state.newElement as ExcalidrawFreeDrawElement;
    expect(element.points).toHaveLength(2);
    expect(element.points[1][0]).toBeCloseTo(60, 3);
    expect(element.points[1][1]).toBeCloseTo(60, 3);

    pointer.upAt(160, 160);
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

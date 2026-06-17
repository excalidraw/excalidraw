import React from "react";

import { CaptureUpdateAction } from "@excalidraw/element";

import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { Keyboard, Pointer, UI } from "./helpers/ui";
import { act, fireEvent, GlobalTestState, render, screen } from "./test-utils";

const { h } = window;
const mouse = new Pointer("mouse");

const dispatchPenEvent = (
  type: "pointerdown" | "pointermove" | "pointerup",
  { clientX, clientY, pressure }: PointerEventInit,
) => {
  const event = new MouseEvent(type, {
    bubbles: true,
    clientX,
    clientY,
  });

  Object.defineProperties(event, {
    pointerId: { value: 9 },
    pointerType: { value: "pen" },
    pressure: { value: pressure },
  });

  fireEvent(GlobalTestState.interactiveCanvas, event);
};

describe("freedraw stroke shapes", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  afterEach(async () => {
    await act(async () => {});
  });

  it("offers five presets and applies the current preset to new strokes", () => {
    UI.clickTool("freedraw");

    expect(screen.getByRole("radio", { name: "Pencil" })).toBeChecked();
    expect(screen.getByTestId("strokeShape-pencil")).toBeChecked();
    expect(screen.getByTestId("strokeShape-marker")).not.toBeChecked();
    expect(screen.getByTestId("strokeShape-brush")).not.toBeChecked();
    expect(screen.getByTestId("strokeShape-technical")).not.toBeChecked();
    expect(screen.getByTestId("strokeShape-calligraphy")).not.toBeChecked();

    fireEvent.click(screen.getByTestId("strokeShape-marker"));
    expect(h.state.currentItemStrokeShape).toBe("marker");

    mouse.down(10, 10);
    mouse.move(20, 10);
    mouse.up(10, 10);

    expect(h.elements[0]).toMatchObject({
      type: "freedraw",
      strokeShape: "marker",
      simulatePressure: true,
      pressures: [],
    });
  });

  it("records physical pressure for pen input that starts at 0.5", () => {
    UI.clickTool("freedraw");

    dispatchPenEvent("pointerdown", {
      clientX: 20,
      clientY: 20,
      pressure: 0.5,
    });
    dispatchPenEvent("pointermove", {
      clientX: 30,
      clientY: 25,
      pressure: 0.25,
    });
    dispatchPenEvent("pointerup", {
      clientX: 40,
      clientY: 30,
      pressure: 0.75,
    });

    expect(h.elements[0]).toMatchObject({
      type: "freedraw",
      simulatePressure: false,
      pressures: [0.5, 0.25, 0.75],
    });
  });

  it("updates only freedraw elements in mixed selections and supports history", () => {
    const freedraw = API.createElement({
      type: "freedraw",
      strokeShape: "brush",
    });
    const rectangle = API.createElement({ type: "rectangle" });
    API.updateScene({
      elements: [freedraw, rectangle],
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
    API.setSelectedElements([freedraw, rectangle]);

    fireEvent.click(screen.getByTestId("strokeShape-technical"));

    expect(h.elements[0]).toMatchObject({
      id: freedraw.id,
      strokeShape: "technical",
    });
    expect(h.elements[1]).toEqual(rectangle);

    Keyboard.undo();
    expect(h.elements[0]).toMatchObject({
      id: freedraw.id,
      strokeShape: "brush",
    });

    Keyboard.redo();
    expect(h.elements[0]).toMatchObject({
      id: freedraw.id,
      strokeShape: "technical",
    });
  });

  it("does not report a selected preset for a mixed freedraw selection", () => {
    const pencil = API.createElement({
      type: "freedraw",
      strokeShape: "pencil",
    });
    const marker = API.createElement({
      type: "freedraw",
      strokeShape: "marker",
    });
    API.setElements([pencil, marker]);
    API.setSelectedElements([pencil, marker]);

    expect(screen.getByTestId("strokeShape-pencil")).not.toBeChecked();
    expect(screen.getByTestId("strokeShape-marker")).not.toBeChecked();
  });
});

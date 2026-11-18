import React from "react";

import { COLOR_PALETTE, KEYS, arrayToMap } from "@excalidraw/common";
import { LinearElementEditor } from "@excalidraw/element";
import { pointFrom } from "@excalidraw/math";

import type {
  ExcalidrawArrowElement,
  ExcalidrawElement,
  ExcalidrawTextElement,
  NonDeleted,
} from "@excalidraw/element/types";

import { actionWrapSelectionInFrame } from "../actions/actionFrame";
import {
  actionChangeFontSize,
  actionChangeStrokeColor,
} from "../actions/actionProperties";
import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { Keyboard, Pointer } from "./helpers/ui";
import { act, render } from "./test-utils";

const { h } = window;

const getElement = <T extends ExcalidrawElement>(id: string) =>
  h.app.scene.getElementsMapIncludingDeleted().get(id) as T;

const selectedIds = () =>
  Object.keys(h.state.selectedElementIds).filter(
    (id) => h.state.selectedElementIds[id],
  );

const pressW = () => Keyboard.keyPress(KEYS.W);

const mouse = new Pointer("mouse");

const dragBy = (element: ExcalidrawElement, dx: number, dy: number) => {
  const x = element.x + element.width / 2;
  const y = element.y + element.height / 2;
  mouse.reset();
  mouse.downAt(x, y);
  mouse.moveTo(x + dx, y + dy);
  mouse.upAt(x + dx, y + dy);
};

const createLabeled = (
  type: "rectangle" | "diamond",
  id: string,
  boundElements: ExcalidrawElement["boundElements"] = [
    { type: "text", id: `${id}-label` },
  ],
) => {
  const container = API.createElement({
    type,
    id,
    y: 0,
    width: 200,
    height: 100,
    boundElements,
  });
  const label = API.createElement({
    type: "text",
    id: `${id}-label`,
    x: 50,
    y: 40,
    text: id,
    containerId: id,
    frameId: container.frameId,
    textAlign: "center",
    verticalAlign: "middle",
  });
  return [container, label] as const;
};

describe("wrap (w)", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  afterEach(async () => {
    await act(async () => {});
  });

  it("binds a text to the selected container", () => {
    const rectangle = API.createElement({ type: "rectangle", id: "rect" });
    const text = API.createElement({ type: "text", id: "text", x: 300 });
    API.setElements([rectangle, text]);
    API.setSelectedElements([rectangle, text]);

    pressW();

    expect(getElement<ExcalidrawTextElement>("text").containerId).toBe("rect");
    expect(selectedIds()).toEqual(["rect"]);
  });

  it("binds a text to the selected arrow, selecting the arrow to edit", () => {
    const arrow = API.createElement({ type: "arrow", id: "arrow" });
    const text = API.createElement({ type: "text", id: "text", x: 300 });
    API.setElements([arrow, text]);
    API.setSelectedElements([arrow, text]);

    pressW();

    expect(getElement<ExcalidrawTextElement>("text").containerId).toBe("arrow");
    expect(h.state.selectedLinearElement?.elementId).toBe("arrow");
  });

  it("wraps a text in a default rectangle of the text's color", () => {
    const text = API.createElement({
      type: "text",
      id: "text",
      strokeColor: COLOR_PALETTE.blue[4],
    });
    API.setElements([text]);
    API.setSelectedElements([text]);
    act(() => {
      h.setState({
        currentItemStrokeColor: COLOR_PALETTE.red[4],
        currentItemBackgroundColor: COLOR_PALETTE.yellow[1],
        currentItemStrokeStyle: "dashed",
      });
    });

    pressW();

    const containerId = getElement<ExcalidrawTextElement>("text").containerId!;
    expect(getElement(containerId)).toMatchObject({
      strokeColor: COLOR_PALETTE.blue[4],
      backgroundColor: "transparent",
      strokeStyle: "solid",
    });
  });

  it("wraps texts, keeping labeled containers selected to unwrap next", () => {
    const [rectangle, label] = createLabeled("rectangle", "rect");
    const text = API.createElement({ type: "text", id: "text", x: 300 });
    API.setElements([rectangle, label, text]);
    API.setSelectedElements([rectangle, text]);

    pressW();

    const containerId = getElement<ExcalidrawTextElement>("text").containerId!;
    expect(containerId).toBeTruthy();
    expect(selectedIds().sort()).toEqual([containerId, "rect"].sort());

    pressW();

    expect(getElement("rect").isDeleted).toBe(true);
    expect(getElement(containerId).isDeleted).toBe(true);
    expect(getElement<ExcalidrawTextElement>("rect-label").containerId).toBe(
      null,
    );
    expect(getElement<ExcalidrawTextElement>("text").containerId).toBe(null);
    expect(selectedIds().sort()).toEqual(["rect-label", "text"]);
  });

  it("unwraps a text as it rendered, at a fixed width", () => {
    const rectangle = API.createElement({
      type: "rectangle",
      id: "rect",
      width: 120,
      height: 100,
    });
    const text = API.createElement({
      type: "text",
      id: "text",
      x: 300,
      text: "a label long enough to wrap",
    });
    API.setElements([rectangle, text]);
    API.setSelectedElements([rectangle, text]);
    pressW();
    const label = getElement<ExcalidrawTextElement>("text");
    const { width, text: wrapped } = label;
    expect(wrapped).toContain("\n");

    API.setSelectedElements([getElement("rect")]);
    pressW();

    expect(getElement<ExcalidrawTextElement>("text")).toMatchObject({
      containerId: null,
      autoResize: false,
      width,
      text: wrapped,
    });

    pressW();

    expect(getElement<ExcalidrawTextElement>("text")).toMatchObject({
      containerId: "rect",
      autoResize: true,
    });
  });

  it("brings back the unwrapped containers, arrows included", () => {
    const [diamond, label] = createLabeled("diamond", "diamond", [
      { type: "text", id: "diamond-label" },
      { type: "arrow", id: "arrow" },
    ]);
    const arrow = API.createElement({
      type: "arrow",
      id: "arrow",
      x: 100,
      y: 400,
      width: 0,
      height: -300,
      points: [pointFrom(0, 0), pointFrom(0, -300)],
      endBinding: { elementId: "diamond", fixedPoint: [0.5, 1], mode: "orbit" },
    });
    API.setElements([diamond, label, arrow]);
    API.setSelectedElements([diamond]);

    pressW();

    expect(getElement("diamond").isDeleted).toBe(true);
    expect(
      getElement<ExcalidrawArrowElement>("arrow").endBinding?.elementId,
    ).toBe("diamond-label");
    expect(getElement("diamond-label").boundElements).toEqual([
      { type: "arrow", id: "arrow" },
    ]);
    expect(selectedIds()).toEqual(["diamond-label"]);

    pressW();

    expect(getElement("diamond").isDeleted).toBe(false);
    expect(getElement<ExcalidrawTextElement>("diamond-label").containerId).toBe(
      "diamond",
    );
    expect(getElement<ExcalidrawArrowElement>("arrow").endBinding).toEqual({
      elementId: "diamond",
      fixedPoint: [0.5, 1],
      mode: "orbit",
    });
    expect(getElement("diamond").boundElements).toEqual([
      { type: "text", id: "diamond-label" },
      { type: "arrow", id: "arrow" },
    ]);
    expect(getElement("diamond-label").boundElements).toBe(null);
    expect(selectedIds()).toEqual(["diamond"]);
  });

  it("brings back an unwrapped arrow", () => {
    const [arrow, label] = API.createLabeledArrow();
    API.setElements([arrow, label]);
    API.setSelectedElements([arrow]);

    pressW();

    expect(getElement(arrow.id).isDeleted).toBe(true);
    expect(selectedIds()).toEqual([label.id]);

    pressW();

    expect(getElement(arrow.id).isDeleted).toBe(false);
    expect(getElement<ExcalidrawTextElement>(label.id).containerId).toBe(
      arrow.id,
    );
    expect(selectedIds()).toEqual([arrow.id]);
  });

  it("drops the point editor of an unwrapped arrow", () => {
    const [arrow, label] = API.createLabeledArrow();
    API.setElements([arrow, label]);
    API.setSelectedElements([arrow]);
    act(() => {
      h.setState({
        selectedLinearElement: {
          ...new LinearElementEditor(
            arrow as NonDeleted<ExcalidrawArrowElement>,
            arrayToMap(h.elements),
          ),
          isEditing: true,
        },
      });
    });

    pressW();

    expect(h.state.selectedLinearElement).toBe(null);
  });

  it("brings a note back with the label's font size and color", () => {
    const note = API.createElement({ type: "stickynote", id: "note" });
    const text = API.createElement({
      type: "text",
      id: "text",
      text: "note",
      fontSize: 20,
    });
    API.setElements([note, text]);
    API.setSelectedElements([note, text]);
    pressW();
    expect(getElement<ExcalidrawTextElement>("text").baseFontSize).toBe(20);

    API.setSelectedElements([getElement("note")]);
    pressW();
    act(() => {
      h.app.actionManager.executeAction(actionChangeFontSize, "ui", 36);
      h.app.actionManager.executeAction(actionChangeStrokeColor, "ui", {
        color: COLOR_PALETTE.red[4],
      });
    });
    pressW();

    expect(getElement<ExcalidrawTextElement>("text")).toMatchObject({
      containerId: "note",
      baseFontSize: 36,
      strokeColor: COLOR_PALETTE.red[4],
    });
    expect(getElement("note").strokeColor).toBe(COLOR_PALETTE.red[4]);
  });

  it("wraps in a new container once the selection changed", () => {
    const [diamond, label] = createLabeled("diamond", "diamond");
    API.setElements([diamond, label]);
    API.setSelectedElements([diamond]);

    pressW();
    API.setSelectedElements([]);
    API.setSelectedElements([getElement(label.id)]);
    pressW();

    expect(getElement("diamond").isDeleted).toBe(true);
    const container = getElement(
      getElement<ExcalidrawTextElement>(label.id).containerId!,
    );
    expect(container.type).toBe("rectangle");
  });

  it("brings the container back where its text was moved", () => {
    const [diamond, label] = createLabeled("diamond", "diamond");
    API.setElements([diamond, label]);
    API.setSelectedElements([diamond]);

    pressW();
    dragBy(getElement(label.id), 100, 50);
    pressW();

    expect(getElement("diamond")).toMatchObject({
      isDeleted: false,
      x: 100,
      y: 50,
    });
    expect(getElement<ExcalidrawTextElement>(label.id).containerId).toBe(
      "diamond",
    );
  });

  it("doesn't count resizing the text as moving it", () => {
    const [rectangle, label] = createLabeled("rectangle", "rect");
    API.setElements([rectangle, label]);
    API.setSelectedElements([rectangle]);

    pressW();
    act(() => {
      h.app.actionManager.executeAction(actionChangeFontSize, "ui", 36);
    });
    dragBy(getElement(label.id), 100, 50);
    pressW();

    expect(getElement("rect").x).toBeCloseTo(100);
    expect(getElement("rect").y).toBeCloseTo(50);
  });

  it("brings the container back into the frame its text was moved to", () => {
    const [diamond, label] = createLabeled("diamond", "diamond");
    const frame = API.createElement({
      type: "frame",
      id: "frame",
      x: 400,
      y: -100,
      width: 400,
      height: 400,
    });
    API.setElements([frame, diamond, label]);
    API.setSelectedElements([diamond]);

    pressW();
    dragBy(getElement(label.id), 500, 0);
    expect(getElement(label.id).frameId).toBe("frame");
    pressW();

    expect(getElement("diamond").frameId).toBe("frame");
    const ids = h.elements.map((element) => element.id);
    expect(ids.indexOf("diamond")).toBe(ids.indexOf(label.id) - 1);
  });

  it("leaves an arrow connecting elements in place", () => {
    const rectangle = API.createElement({
      type: "rectangle",
      id: "rect",
      x: 300,
      width: 100,
      height: 100,
      boundElements: [{ type: "arrow", id: "arrow" }],
    });
    const arrow = API.createElement({
      type: "arrow",
      id: "arrow",
      y: 50,
      width: 295,
      height: 0,
      points: [pointFrom(0, 0), pointFrom(295, 0)],
      endBinding: { elementId: "rect", fixedPoint: [0, 0.5], mode: "orbit" },
      boundElements: [{ type: "text", id: "label" }],
    });
    const label = API.createElement({
      type: "text",
      id: "label",
      x: 120,
      y: 40,
      text: "label",
      containerId: "arrow",
    });
    API.setElements([rectangle, arrow, label]);
    API.setSelectedElements([arrow]);

    pressW();
    dragBy(getElement("label"), 100, 200);
    pressW();

    expect(getElement("arrow")).toMatchObject({ isDeleted: false, x: 0 });
    expect(getElement<ExcalidrawTextElement>("label").containerId).toBe(
      "arrow",
    );
    expect(getElement("rect").boundElements).toEqual([
      { type: "arrow", id: "arrow" },
    ]);
  });

  describe("frames", () => {
    const createFrameWithChildren = () => {
      const frame = API.createElement({
        type: "frame",
        id: "frame",
        width: 500,
        height: 500,
      });
      const children = ["a", "b"].map((id, index) =>
        API.createElement({
          type: "rectangle",
          id,
          x: 50 + index * 200,
          y: 50,
          frameId: "frame",
        }),
      );
      API.setElements([...children, frame]);
      return { frame, children };
    };

    it("removes a selected frame along with its children", () => {
      const { frame, children } = createFrameWithChildren();
      API.setSelectedElements([frame, ...children]);

      pressW();

      expect(getElement("frame").isDeleted).toBe(true);
      expect(children.map((child) => getElement(child.id).frameId)).toEqual([
        null,
        null,
      ]);
      expect(selectedIds().sort()).toEqual(["a", "b"]);
    });

    it("removes the frame when all its children are selected", () => {
      const { children } = createFrameWithChildren();
      API.setSelectedElements(children);

      API.executeAction(actionWrapSelectionInFrame);

      expect(getElement("frame").isDeleted).toBe(true);
      expect(getElement("a").frameId).toBe(null);
      expect(selectedIds().sort()).toEqual(["a", "b"]);
    });

    it("moves some of a frame's children into a new frame", () => {
      const { children } = createFrameWithChildren();
      API.setSelectedElements([children[0]]);

      pressW();

      expect(getElement("frame").isDeleted).toBe(false);
      const newFrameId = getElement("a").frameId;
      expect(newFrameId).not.toBe("frame");
      expect(getElement(newFrameId!).type).toBe("frame");
      expect(getElement("b").frameId).toBe("frame");
    });

    it("drops the point editor of an arrow it frames", () => {
      const arrow = API.createElement({ type: "arrow" });
      API.setElements([arrow]);
      API.setSelectedElements([arrow]);
      act(() => {
        h.setState({
          selectedLinearElement: new LinearElementEditor(
            arrow,
            arrayToMap(h.elements),
          ),
        });
      });

      pressW();

      expect(getElement(arrow.id).frameId).toBeTruthy();
      expect(h.state.selectedLinearElement).toBe(null);
    });

    it("leaves several frames be", () => {
      const frames = [0, 600].map((x, index) =>
        API.createElement({ type: "frame", id: `frame${index}`, x }),
      );
      API.setElements(frames);
      API.setSelectedElements(frames);

      pressW();

      expect(h.elements.filter((element) => !element.isDeleted)).toEqual(
        frames,
      );
    });

    it("wraps shapes with padding, and an image edge to edge", () => {
      const rectangle = API.createElement({
        type: "rectangle",
        x: 100,
        y: 100,
        width: 100,
        height: 100,
      });
      API.setElements([rectangle]);
      API.setSelectedElements([rectangle]);

      pressW();

      const frame = getElement(rectangle.id).frameId!;
      expect(getElement(frame)).toMatchObject({ x: 84, y: 84, width: 132 });

      const image = API.createElement({
        type: "image",
        x: 400,
        y: 100,
        width: 300,
        height: 200,
      });
      const mark = API.createElement({
        type: "rectangle",
        x: 450,
        y: 150,
        width: 50,
        height: 50,
      });
      API.setElements([...h.elements, image, mark]);
      API.setSelectedElements([image, mark]);

      pressW();

      expect(getElement(getElement(image.id).frameId!)).toMatchObject({
        x: 400,
        y: 100,
        width: 300,
        height: 200,
      });
    });
  });
});

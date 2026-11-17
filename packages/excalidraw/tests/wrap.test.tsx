import React from "react";

import { COLOR_PALETTE, KEYS, arrayToMap } from "@excalidraw/common";
import { LinearElementEditor, newElementWith } from "@excalidraw/element";
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

import { CaptureUpdateAction } from "../captureUpdate";

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

/**
 * wraps a text in a new container and unwraps it again, removing the
 * container — returning the container as it was
 */
const wrapAndUnwrapText = (elements: readonly ExcalidrawElement[] = []) => {
  const text = API.createElement({ type: "text", id: "text", x: 0, y: 0 });
  API.setElements([...elements, text]);
  API.setSelectedElements([text]);

  pressW();
  const containerId = getElement<ExcalidrawTextElement>("text").containerId!;
  const { x, y } = getElement(containerId);
  pressW();
  expect(getElement(containerId).isDeleted).toBe(true);

  return { containerId, x, y };
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

    // only the container it made is removed
    expect(getElement(containerId).isDeleted).toBe(true);
    expect(getElement("rect").isDeleted).toBe(false);
    expect(getElement<ExcalidrawTextElement>("rect-label").containerId).toBe(
      null,
    );
    expect(getElement<ExcalidrawTextElement>("text").containerId).toBe(null);
    expect(selectedIds().sort()).toEqual(["rect", "rect-label", "text"]);

    pressW();

    expect(getElement(containerId).isDeleted).toBe(false);
    expect(getElement<ExcalidrawTextElement>("text").containerId).toBe(
      containerId,
    );
    expect(getElement<ExcalidrawTextElement>("rect-label").containerId).toBe(
      "rect",
    );
    expect(selectedIds().sort()).toEqual([containerId, "rect"].sort());
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

  it("brings back the container it made and removed, arrows included", () => {
    const text = API.createElement({
      type: "text",
      id: "text",
      y: 0,
      boundElements: [{ type: "arrow", id: "arrow" }],
    });
    const arrow = API.createElement({
      type: "arrow",
      id: "arrow",
      x: 50,
      y: 400,
      width: 0,
      height: -300,
      points: [pointFrom(0, 0), pointFrom(0, -300)],
      endBinding: { elementId: "text", fixedPoint: [0.5, 1], mode: "orbit" },
    });
    API.setElements([text, arrow]);
    API.setSelectedElements([text]);

    pressW();

    const containerId = getElement<ExcalidrawTextElement>("text").containerId!;
    const endBinding = {
      elementId: containerId,
      fixedPoint: [0.5, 1],
      mode: "orbit",
    };
    expect(getElement<ExcalidrawArrowElement>("arrow").endBinding).toEqual(
      endBinding,
    );

    pressW();

    expect(getElement(containerId).isDeleted).toBe(true);
    expect(
      getElement<ExcalidrawArrowElement>("arrow").endBinding?.elementId,
    ).toBe("text");
    expect(getElement("text").boundElements).toEqual([
      { type: "arrow", id: "arrow" },
    ]);
    expect(selectedIds()).toEqual(["text"]);

    pressW();

    expect(getElement(containerId).isDeleted).toBe(false);
    expect(getElement<ExcalidrawTextElement>("text").containerId).toBe(
      containerId,
    );
    expect(getElement<ExcalidrawArrowElement>("arrow").endBinding).toEqual(
      endBinding,
    );
    expect(getElement(containerId).boundElements).toEqual([
      { type: "text", id: "text" },
      { type: "arrow", id: "arrow" },
    ]);
    expect(getElement("text").boundElements).toBe(null);
    expect(selectedIds()).toEqual([containerId]);
  });

  it("unbinds the texts of other containers, keeping both selected", () => {
    const [rectangle, label] = createLabeled("rectangle", "rect");
    const [arrow, arrowLabel] = API.createLabeledArrow();
    API.setElements([
      rectangle,
      newElementWith(label, { textAlign: "left" }),
      arrow,
      arrowLabel,
    ]);
    API.setSelectedElements([rectangle, arrow]);

    pressW();

    expect(h.elements.some((element) => element.isDeleted)).toBe(false);
    expect(getElement<ExcalidrawTextElement>(label.id).containerId).toBe(null);
    expect(getElement<ExcalidrawTextElement>(arrowLabel.id).containerId).toBe(
      null,
    );
    expect(selectedIds().sort()).toEqual(
      [rectangle.id, label.id, arrow.id, arrowLabel.id].sort(),
    );

    pressW();

    // back as they sat in their containers
    expect(getElement<ExcalidrawTextElement>(label.id)).toMatchObject({
      containerId: rectangle.id,
      textAlign: "left",
    });
    expect(getElement<ExcalidrawTextElement>(arrowLabel.id).containerId).toBe(
      arrow.id,
    );
    expect(selectedIds().sort()).toEqual([rectangle.id, arrow.id].sort());
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

  it("binds a note's label back with its new font size and color", () => {
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

  it("forgets the container it made once the selection changed", () => {
    const text = API.createElement({ type: "text", id: "text" });
    API.setElements([text]);
    API.setSelectedElements([text]);

    pressW();
    const containerId = getElement<ExcalidrawTextElement>("text").containerId!;
    API.setSelectedElements([]);
    API.setSelectedElements([getElement(containerId)]);
    pressW();

    // kept, as any other container
    expect(getElement(containerId).isDeleted).toBe(false);
    expect(getElement<ExcalidrawTextElement>("text").containerId).toBe(null);
    expect(selectedIds().sort()).toEqual([containerId, "text"].sort());
  });

  it("wraps in a new container once the selection changed", () => {
    const text = API.createElement({ type: "text", id: "text" });
    API.setElements([text]);
    API.setSelectedElements([text]);

    pressW();
    const containerId = getElement<ExcalidrawTextElement>("text").containerId!;
    pressW();
    API.setSelectedElements([]);
    API.setSelectedElements([getElement("text")]);
    pressW();

    expect(getElement(containerId).isDeleted).toBe(true);
    expect(getElement<ExcalidrawTextElement>("text").containerId).not.toBe(
      containerId,
    );
  });

  it("brings the container back where its text was moved", () => {
    const { containerId, x, y } = wrapAndUnwrapText();

    dragBy(getElement("text"), 100, 50);
    pressW();

    expect(getElement(containerId)).toMatchObject({
      isDeleted: false,
      x: x + 100,
      y: y + 50,
    });
    expect(getElement<ExcalidrawTextElement>("text").containerId).toBe(
      containerId,
    );
  });

  it("doesn't count resizing the text as moving it", () => {
    const { containerId, x, y } = wrapAndUnwrapText();

    act(() => {
      h.app.actionManager.executeAction(actionChangeFontSize, "ui", 36);
    });
    dragBy(getElement("text"), 100, 50);
    pressW();

    expect(getElement(containerId).x).toBeCloseTo(x + 100);
    expect(getElement(containerId).y).toBeCloseTo(y + 50);
  });

  it("brings the container back into the frame its text was moved to", () => {
    const frame = API.createElement({
      type: "frame",
      id: "frame",
      x: 400,
      y: -100,
      width: 400,
      height: 400,
    });
    const { containerId } = wrapAndUnwrapText([frame]);

    dragBy(getElement("text"), 500, 0);
    expect(getElement("text").frameId).toBe("frame");
    pressW();

    expect(getElement(containerId).frameId).toBe("frame");
    const ids = h.elements.map((element) => element.id);
    expect(ids.indexOf(containerId)).toBe(ids.indexOf("text") - 1);
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

    it("frames the deselected elements within the selection, below the rest", () => {
      const rectangle = (
        id: string,
        x: number,
        y: number,
        width: number,
        height: number,
      ) => API.createElement({ type: "rectangle", id, x, y, width, height });

      const selected = rectangle("selected", 0, 0, 300, 200);
      const inside = rectangle("inside", 200, 50, 50, 50);
      // reaching out of the selection by the frame's padding, and beyond it
      const near = rectangle("near", 20, 150, 100, 66);
      const far = rectangle("far", 150, 150, 100, 67);
      // within the padding, yet not overlapping the selection
      const beside = rectangle("beside", 305, 50, 10, 50);
      API.setElements([selected, far, inside, near, beside]);
      API.setSelectedElements([selected]);

      pressW();

      const frame = getElement(getElement("selected").frameId!);
      expect(frame).toMatchObject({ x: -16, y: -16, width: 332, height: 248 });
      expect(h.elements.map((element) => element.id)).toEqual([
        "selected",
        "inside",
        "near",
        frame.id,
        "far",
        "beside",
      ]);
      expect(
        h.elements.map((element) => element.frameId).filter(Boolean),
      ).toEqual([frame.id, frame.id, frame.id]);
    });

    it("frames a group whole, along with its locked elements", () => {
      const selected = API.createElement({
        type: "rectangle",
        id: "selected",
        width: 300,
        height: 200,
      });
      const group = [50, 150].map((x, index) =>
        API.createElement({
          type: "rectangle",
          x,
          y: 50,
          width: 50,
          height: 50,
          groupIds: ["group"],
          locked: index === 1,
        }),
      );
      API.setElements([selected, ...group]);
      API.setSelectedElements([selected]);

      pressW();

      const frameId = getElement("selected").frameId;
      expect(frameId).toBeTruthy();
      expect(group.map((element) => getElement(element.id).frameId)).toEqual([
        frameId,
        frameId,
      ]);
    });

    it("restores the stacking order when undoing wraps", () => {
      const rectangle = (id: string, x: number, width: number) =>
        API.createElement({
          type: "rectangle",
          id,
          x,
          y: 0,
          width,
          height: 200,
        });
      // `z` gets framed along with `A`, `c` along with `B`
      API.updateScene({
        elements: [
          rectangle("A", 0, 200),
          rectangle("B", 300, 200),
          rectangle("z", 150, 60),
          rectangle("c", 290, 50),
        ],
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
      const order = () =>
        h.elements
          .filter((element) => !element.isDeleted)
          .map((element) => element.id);

      for (const id of ["A", "B"]) {
        API.setSelectedElements([getElement(id)]);
        pressW();
      }
      expect(getElement("z").frameId).toBe(getElement("A").frameId);
      expect(getElement("c").frameId).toBe(getElement("B").frameId);

      Keyboard.undo();
      Keyboard.undo();

      expect(order()).toEqual(["A", "B", "z", "c"]);
    });

    it("frames what reaches out of an image, edge to edge with the image", () => {
      const image = API.createElement({
        type: "image",
        id: "image",
        width: 300,
        height: 200,
      });
      const mark = API.createElement({
        type: "rectangle",
        id: "mark",
        x: 250,
        y: 50,
        width: 60,
        height: 50,
      });
      API.setElements([image, mark]);
      API.setSelectedElements([image]);

      pressW();

      const frame = getElement(getElement("image").frameId!);
      expect(getElement("mark").frameId).toBe(frame.id);
      expect(frame).toMatchObject({ x: 0, y: 0, width: 300, height: 200 });
    });
  });
});

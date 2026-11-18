import React from "react";

import { sceneCoordsToViewportCoords } from "@excalidraw/common";
import { pointFrom, type LocalPoint } from "@excalidraw/math";

import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { Keyboard, Pointer, UI } from "./helpers/ui";
import { act, render } from "./test-utils";

const mouse = new Pointer("mouse");
const touch = new Pointer("touch");
const pen = new Pointer("pen");
const { h } = window;

describe("eraser topmost contact", () => {
  beforeEach(async () => {
    mouse.reset();
    touch.reset();
    pen.reset();
    await render(<Excalidraw handleKeyboardGlobally={true} />);
    API.setAppState({ width: 1000, height: 1000 });
  });

  const activateEraser = () => UI.clickTool("eraser");

  const createOverlappingRectangles = () => {
    const bottom = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      backgroundColor: "red",
      fillStyle: "solid",
    });
    const top = API.createElement({
      type: "rectangle",
      x: 50,
      y: 50,
      width: 100,
      height: 100,
      backgroundColor: "blue",
      fillStyle: "solid",
    });
    API.setElements([bottom, top]);
    activateEraser();
    return { bottom, top };
  };

  it("clicks only the topmost overlapping shape", () => {
    const { bottom, top } = createOverlappingRectangles();

    mouse.clickAt(75, 75);

    expect(API.getElement(top).isDeleted).toBe(true);
    expect(API.getElement(bottom).isDeleted).toBe(false);
  });

  it("uses eraser contact for unfilled shape outlines", () => {
    const bottom = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    });
    const top = API.createElement({
      type: "rectangle",
      x: 50,
      y: 50,
      width: 100,
      height: 100,
    });
    API.setElements([bottom, top]);
    activateEraser();

    mouse.clickAt(50, 75);

    expect(API.getElement(top).isDeleted).toBe(true);
    expect(API.getElement(bottom).isDeleted).toBe(false);
  });

  it("detects contact with a narrow line", () => {
    const bottom = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 120,
      height: 100,
      backgroundColor: "red",
      fillStyle: "solid",
    });
    const top = API.createElement({
      type: "line",
      x: 20,
      y: 50,
      width: 80,
      height: 1,
      points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(80, 1)],
      strokeWidth: 1,
    });
    API.setElements([bottom, top]);
    activateEraser();

    mouse.downAt(20, 50);
    mouse.moveTo(100, 51);
    mouse.upAt(100, 51);

    expect(API.getElement(top).isDeleted).toBe(true);
    expect(API.getElement(bottom).isDeleted).toBe(false);
  });

  it("drags only the topmost overlapping shape", () => {
    const { bottom, top } = createOverlappingRectangles();

    mouse.downAt(60, 75);
    mouse.moveTo(90, 75);
    mouse.upAt(90, 75);

    expect(API.getElement(top).isDeleted).toBe(true);
    expect(API.getElement(bottom).isDeleted).toBe(false);
  });

  it("chooses the topmost shape at each contact along a three-layer drag", () => {
    const bottom = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 150,
      height: 100,
      backgroundColor: "red",
      fillStyle: "solid",
    });
    const middle = API.createElement({
      type: "ellipse",
      x: 30,
      y: 20,
      width: 100,
      height: 60,
      backgroundColor: "green",
      fillStyle: "solid",
    });
    const top = API.createElement({
      type: "rectangle",
      x: 80,
      y: 35,
      width: 30,
      height: 30,
      backgroundColor: "blue",
      fillStyle: "solid",
    });
    API.setElements([bottom, middle, top]);
    activateEraser();

    mouse.downAt(40, 50);
    mouse.moveTo(100, 50);
    mouse.upAt(100, 50);

    expect(API.getElement(middle).isDeleted).toBe(true);
    expect(API.getElement(top).isDeleted).toBe(true);
    expect(API.getElement(bottom).isDeleted).toBe(false);
  });

  it("uses curved shape geometry for topmost contacts", () => {
    const bottom = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 120,
      height: 100,
      backgroundColor: "red",
      fillStyle: "solid",
    });
    const top = API.createElement({
      type: "ellipse",
      x: 30,
      y: 20,
      width: 60,
      height: 60,
      backgroundColor: "blue",
      fillStyle: "solid",
    });
    API.setElements([bottom, top]);
    activateEraser();

    mouse.downAt(40, 50);
    mouse.moveTo(80, 50);
    mouse.upAt(80, 50);

    expect(API.getElement(top).isDeleted).toBe(true);
    expect(API.getElement(bottom).isDeleted).toBe(false);
  });

  it.each([0.1, 4])("preserves topmost contact at zoom %s", (zoom) => {
    const { bottom, top } = createOverlappingRectangles();
    API.setAppState({
      zoom: { value: zoom as typeof h.state.zoom.value },
    });
    const start = sceneCoordsToViewportCoords(
      { sceneX: 60, sceneY: 75 },
      h.state,
    );
    const end = sceneCoordsToViewportCoords(
      { sceneX: 90, sceneY: 75 },
      h.state,
    );

    mouse.downAt(start.x, start.y);
    mouse.moveTo(end.x, end.y);
    mouse.upAt(end.x, end.y);

    expect(API.getElement(top).isDeleted).toBe(true);
    expect(API.getElement(bottom).isDeleted).toBe(false);
  });

  it("keeps long overlapping drags limited to topmost contacts", () => {
    const elements = Array.from({ length: 40 }, (_, index) =>
      API.createElement({
        type: "rectangle",
        x: index * 2,
        y: 20,
        width: 600,
        height: 60,
        backgroundColor: index === 39 ? "blue" : "red",
        fillStyle: "solid",
      }),
    );
    API.setElements(elements);
    activateEraser();

    mouse.downAt(100, 50);
    mouse.moveTo(500, 50);
    mouse.upAt(500, 50);

    expect(API.getElement(elements[39]).isDeleted).toBe(true);
    expect(
      elements
        .slice(0, 39)
        .every((element) => !API.getElement(element).isDeleted),
    ).toBe(true);
  });

  it("erases the exposed part of a partially overlapping shape", () => {
    const bottom = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 150,
      height: 100,
      backgroundColor: "red",
      fillStyle: "solid",
    });
    const middle = API.createElement({
      type: "rectangle",
      x: 30,
      y: 20,
      width: 100,
      height: 60,
      backgroundColor: "green",
      fillStyle: "solid",
    });
    const top = API.createElement({
      type: "rectangle",
      x: 80,
      y: 35,
      width: 30,
      height: 30,
      backgroundColor: "blue",
      fillStyle: "solid",
    });
    API.setElements([bottom, middle, top]);
    activateEraser();

    mouse.downAt(40, 50);
    mouse.moveTo(70, 50);
    mouse.upAt(70, 50);

    expect(API.getElement(middle).isDeleted).toBe(true);
    expect(API.getElement(top).isDeleted).toBe(false);
    expect(API.getElement(bottom).isDeleted).toBe(false);
  });

  it("erases a freedraw annotation over an image without erasing the image", () => {
    const image = API.createElement({
      type: "image",
      x: 0,
      y: 0,
      width: 120,
      height: 100,
      fileId: "test-image",
    });
    const annotation = API.createElement({
      type: "freedraw",
      x: 0,
      y: 45,
      width: 120,
      height: 10,
      points: [pointFrom<LocalPoint>(0, 5), pointFrom<LocalPoint>(120, 5)],
    });
    API.setElements([image, annotation]);
    activateEraser();

    mouse.downAt(35, 50);
    mouse.moveTo(85, 50);
    mouse.upAt(85, 50);

    expect(API.getElement(annotation).isDeleted).toBe(true);
    expect(API.getElement(image).isDeleted).toBe(false);
  });

  it("detects contact with curved freedraw geometry over an image", () => {
    const image = API.createElement({
      type: "image",
      x: 0,
      y: 0,
      width: 120,
      height: 100,
      fileId: "test-image",
    });
    const annotation = API.createElement({
      type: "freedraw",
      x: 0,
      y: 40,
      width: 100,
      height: 30,
      points: [
        pointFrom<LocalPoint>(0, 20),
        pointFrom<LocalPoint>(25, 0),
        pointFrom<LocalPoint>(50, 30),
        pointFrom<LocalPoint>(75, 0),
        pointFrom<LocalPoint>(100, 20),
      ],
    });
    API.setElements([image, annotation]);
    activateEraser();

    mouse.downAt(10, 55);
    mouse.moveTo(40, 55);
    mouse.upAt(40, 55);

    expect(API.getElement(annotation).isDeleted).toBe(true);
    expect(API.getElement(image).isDeleted).toBe(false);
  });

  it("erases an image without affecting unrelated elements", () => {
    const image = API.createElement({
      type: "image",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      fileId: "test-image",
    });
    const unrelated = API.createElement({
      type: "rectangle",
      x: 200,
      y: 200,
      width: 50,
      height: 50,
      fillStyle: "solid",
    });
    API.setElements([image, unrelated]);
    activateEraser();

    mouse.downAt(20, 50);
    mouse.moveTo(80, 50);
    mouse.upAt(80, 50);

    expect(API.getElement(image).isDeleted).toBe(true);
    expect(API.getElement(unrelated).isDeleted).toBe(false);
  });

  it("erases newly exposed layers on a subsequent pass", () => {
    const { bottom, top } = createOverlappingRectangles();

    mouse.downAt(60, 75);
    mouse.moveTo(90, 75);
    mouse.upAt(90, 75);
    expect(API.getElement(top).isDeleted).toBe(true);
    expect(API.getElement(bottom).isDeleted).toBe(false);

    mouse.downAt(60, 75);
    mouse.moveTo(90, 75);
    mouse.upAt(90, 75);
    expect(API.getElement(bottom).isDeleted).toBe(true);
  });

  it("restores a pending erasure when Alt is held over it", () => {
    const { bottom, top } = createOverlappingRectangles();

    mouse.downAt(60, 75);
    mouse.moveTo(90, 75);
    Keyboard.withModifierKeys({ alt: true }, () => {
      mouse.moveTo(60, 75);
      mouse.upAt(60, 75);
    });

    expect(API.getElement(top).isDeleted).toBe(false);
    expect(API.getElement(bottom).isDeleted).toBe(false);
  });

  it("supports undo and redo for a topmost eraser pass", () => {
    const { bottom, top } = createOverlappingRectangles();
    act(() => {
      h.app.store.scheduleCapture();
      h.setState({});
    });
    h.history.clear();

    mouse.clickAt(75, 75);
    expect(API.getElement(top).isDeleted).toBe(true);
    expect(API.getElement(bottom).isDeleted).toBe(false);

    Keyboard.undo();
    expect(API.getElement(top).isDeleted).toBe(false);
    expect(API.getElement(bottom).isDeleted).toBe(false);

    Keyboard.redo();
    expect(API.getElement(top).isDeleted).toBe(true);
    expect(API.getElement(bottom).isDeleted).toBe(false);
  });

  it("preserves group and frame deletion rules", () => {
    const background = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      backgroundColor: "red",
      fillStyle: "solid",
    });
    const groupId = "group";
    const grouped = API.createElement({
      type: "rectangle",
      x: 20,
      y: 20,
      width: 40,
      height: 40,
      backgroundColor: "blue",
      fillStyle: "solid",
      groupIds: [groupId],
    });
    const groupSibling = API.createElement({
      type: "rectangle",
      x: 200,
      y: 20,
      width: 40,
      height: 40,
      backgroundColor: "blue",
      fillStyle: "solid",
      groupIds: [groupId],
    });
    API.setElements([background, grouped, groupSibling]);
    activateEraser();

    mouse.clickAt(30, 30);

    expect(API.getElement(grouped).isDeleted).toBe(true);
    expect(API.getElement(groupSibling).isDeleted).toBe(true);
    expect(API.getElement(background).isDeleted).toBe(false);

    const frame = API.createElement({
      type: "frame",
      x: 0,
      y: 0,
      width: 200,
      height: 200,
    });
    const framedChild = API.createElement({
      type: "rectangle",
      x: 40,
      y: 40,
      width: 60,
      height: 60,
      frameId: frame.id,
      backgroundColor: "blue",
      fillStyle: "solid",
    });
    API.setElements([frame, framedChild]);

    mouse.clickAt(60, 60);

    expect(API.getElement(framedChild).isDeleted).toBe(true);
    expect(API.getElement(frame).isDeleted).toBe(false);
  });

  it("erases a bound text container and unbinds deleted arrows", () => {
    const container = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      boundElements: [{ id: "label", type: "text" }],
    });
    const label = API.createElement({
      id: "label",
      type: "text",
      x: 25,
      y: 40,
      width: 50,
      height: 20,
      text: "label",
      containerId: container.id,
    });
    API.setElements([container, label]);
    activateEraser();

    mouse.clickAt(50, 50);

    expect(API.getElement(container).isDeleted).toBe(true);
    expect(API.getElement(label).isDeleted).toBe(true);

    const bindable = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 30,
      height: 100,
      boundElements: [{ id: "arrow", type: "arrow" }],
    });
    const arrow = API.createElement({
      id: "arrow",
      type: "arrow",
      x: 15,
      y: 50,
      width: 70,
      height: 0,
      points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(70, 0)],
      startBinding: {
        elementId: bindable.id,
        fixedPoint: [0.5, 0.5],
        mode: "orbit",
      },
    });
    API.setElements([bindable, arrow]);

    mouse.downAt(35, 50);
    mouse.moveTo(60, 50);
    mouse.upAt(60, 50);

    expect(API.getElement(arrow).isDeleted).toBe(true);
    expect(API.getElement(bindable).boundElements).toEqual([]);
  });

  it("does not erase anything on an empty canvas", () => {
    const element = API.createElement({
      type: "rectangle",
      x: 200,
      y: 200,
      width: 50,
      height: 50,
    });
    API.setElements([element]);
    activateEraser();

    mouse.clickAt(500, 500);

    expect(API.getElement(element).isDeleted).toBe(false);
  });

  it("does not erase locked elements", () => {
    const bottom = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      backgroundColor: "red",
      fillStyle: "solid",
    });
    const lockedTop = API.createElement({
      type: "rectangle",
      x: 50,
      y: 50,
      width: 100,
      height: 100,
      backgroundColor: "blue",
      fillStyle: "solid",
      locked: true,
    });
    API.setElements([bottom, lockedTop]);
    activateEraser();

    mouse.clickAt(75, 75);

    expect(API.getElement(lockedTop).isDeleted).toBe(false);
    expect(API.getElement(bottom).isDeleted).toBe(true);
  });

  it.each([
    ["mouse", mouse],
    ["touch", touch],
    ["pen", pen],
  ] as const)("uses topmost click behavior for %s input", (_, pointer) => {
    const { bottom, top } = createOverlappingRectangles();

    pointer.clickAt(75, 75);

    expect(API.getElement(top).isDeleted).toBe(true);
    expect(API.getElement(bottom).isDeleted).toBe(false);
  });

  it.each([
    ["mouse", mouse],
    ["touch", touch],
    ["pen", pen],
  ] as const)("uses topmost drag behavior for %s input", (_, pointer) => {
    const { bottom, top } = createOverlappingRectangles();

    pointer.downAt(60, 75);
    pointer.moveTo(90, 75);
    pointer.upAt(90, 75);

    expect(API.getElement(top).isDeleted).toBe(true);
    expect(API.getElement(bottom).isDeleted).toBe(false);
  });
});

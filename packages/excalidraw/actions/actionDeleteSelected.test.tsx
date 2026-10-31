import React from "react";

import { arrayToMap } from "@excalidraw/common";
import { LinearElementEditor } from "@excalidraw/element";
import { pointFrom } from "@excalidraw/math";

import type {
  ExcalidrawArrowElement,
  NonDeleted,
} from "@excalidraw/element/types";

import { Excalidraw } from "../index";
import { API } from "../tests/helpers/api";
import { act, assertElements, render } from "../tests/test-utils";

import { actionCut } from "./actionClipboard";
import { actionDeleteSelected } from "./actionDeleteSelected";

const { h } = window;

describe("deleting selected elements when frame selected should keep children + select them", () => {
  beforeEach(async () => {
    await render(<Excalidraw />);
  });

  it("frame only", async () => {
    const f1 = API.createElement({
      type: "frame",
    });

    const r1 = API.createElement({
      type: "rectangle",
      frameId: f1.id,
    });

    API.setElements([f1, r1]);

    API.setSelectedElements([f1]);

    act(() => {
      h.app.actionManager.executeAction(actionDeleteSelected);
    });

    assertElements(h.elements, [
      { id: f1.id, isDeleted: true },
      { id: r1.id, isDeleted: false, selected: true },
    ]);
  });

  it("frame + text container (text's frameId set)", async () => {
    const f1 = API.createElement({
      type: "frame",
    });

    const r1 = API.createElement({
      type: "rectangle",
      frameId: f1.id,
    });

    const t1 = API.createElement({
      type: "text",
      width: 200,
      height: 100,
      fontSize: 20,
      containerId: r1.id,
      frameId: f1.id,
    });

    h.app.scene.mutateElement(r1, {
      boundElements: [{ type: "text", id: t1.id }],
    });

    API.setElements([f1, r1, t1]);

    API.setSelectedElements([f1]);

    act(() => {
      h.app.actionManager.executeAction(actionDeleteSelected);
    });

    assertElements(h.elements, [
      { id: f1.id, isDeleted: true },
      { id: r1.id, isDeleted: false, selected: true },
      { id: t1.id, isDeleted: false },
    ]);
  });

  it("frame + text container (text's frameId not set)", async () => {
    const f1 = API.createElement({
      type: "frame",
    });

    const r1 = API.createElement({
      type: "rectangle",
      frameId: f1.id,
    });

    const t1 = API.createElement({
      type: "text",
      width: 200,
      height: 100,
      fontSize: 20,
      containerId: r1.id,
      frameId: null,
    });

    h.app.scene.mutateElement(r1, {
      boundElements: [{ type: "text", id: t1.id }],
    });

    API.setElements([f1, r1, t1]);

    API.setSelectedElements([f1]);

    act(() => {
      h.app.actionManager.executeAction(actionDeleteSelected);
    });

    assertElements(h.elements, [
      { id: f1.id, isDeleted: true },
      { id: r1.id, isDeleted: false, selected: true },
      { id: t1.id, isDeleted: false },
    ]);
  });

  it("frame + text container (text selected too)", async () => {
    const f1 = API.createElement({
      type: "frame",
    });

    const r1 = API.createElement({
      type: "rectangle",
      frameId: f1.id,
    });

    const t1 = API.createElement({
      type: "text",
      width: 200,
      height: 100,
      fontSize: 20,
      containerId: r1.id,
      frameId: null,
    });

    h.app.scene.mutateElement(r1, {
      boundElements: [{ type: "text", id: t1.id }],
    });

    API.setElements([f1, r1, t1]);

    API.setSelectedElements([f1, t1]);

    act(() => {
      h.app.actionManager.executeAction(actionDeleteSelected);
    });

    assertElements(h.elements, [
      { id: f1.id, isDeleted: true },
      { id: r1.id, isDeleted: false, selected: true },
      { id: t1.id, isDeleted: false },
    ]);
  });

  it("frame + labeled arrow", async () => {
    const f1 = API.createElement({
      type: "frame",
    });

    const a1 = API.createElement({
      type: "arrow",
      frameId: f1.id,
    });

    const t1 = API.createElement({
      type: "text",
      width: 200,
      height: 100,
      fontSize: 20,
      containerId: a1.id,
      frameId: null,
    });

    h.app.scene.mutateElement(a1, {
      boundElements: [{ type: "text", id: t1.id }],
    });

    API.setElements([f1, a1, t1]);

    API.setSelectedElements([f1, t1]);

    act(() => {
      h.app.actionManager.executeAction(actionDeleteSelected);
    });

    assertElements(h.elements, [
      { id: f1.id, isDeleted: true },
      { id: a1.id, isDeleted: false, selected: true },
      { id: t1.id, isDeleted: false },
    ]);
  });

  it("frame + children selected", async () => {
    const f1 = API.createElement({
      type: "frame",
    });
    const r1 = API.createElement({
      type: "rectangle",
      frameId: f1.id,
    });
    API.setElements([f1, r1]);

    API.setSelectedElements([f1, r1]);

    act(() => {
      h.app.actionManager.executeAction(actionDeleteSelected);
    });

    assertElements(h.elements, [
      { id: f1.id, isDeleted: true },
      { id: r1.id, isDeleted: false, selected: true },
    ]);
  });
});

describe("cutting a selected frame takes its children along", () => {
  beforeEach(async () => {
    await render(<Excalidraw />);
  });

  const createFrameWithChildren = () => {
    const f1 = API.createElement({ type: "frame" });
    const r1 = API.createElement({ type: "rectangle", frameId: f1.id });
    const r2 = API.createElement({ type: "rectangle", frameId: f1.id });
    const t1 = API.createElement({
      type: "text",
      containerId: r2.id,
      frameId: f1.id,
    });
    h.app.scene.mutateElement(r2, {
      boundElements: [{ type: "text", id: t1.id }],
    });
    API.setElements([f1, r1, r2, t1]);
    return { f1, r1, r2, t1 };
  };

  /** as on ctrl+x, with the clipboard data of the cut event */
  const cut = () => {
    const data = new Map<string, string>();
    const event = {
      clipboardData: {
        setData: (type: string, value: string) => data.set(type, value),
        getData: (type: string) => data.get(type),
      },
    } as unknown as ClipboardEvent;
    act(() => {
      h.app.actionManager.executeAction(actionCut, "keyboard", event);
    });
  };

  it("frame only", async () => {
    const { f1, r1, r2, t1 } = createFrameWithChildren();
    API.setSelectedElements([f1]);

    cut();

    assertElements(h.elements, [
      { id: f1.id, isDeleted: true },
      { id: r1.id, isDeleted: true },
      { id: r2.id, isDeleted: true },
      { id: t1.id, isDeleted: true },
    ]);
  });

  it("frame + children selected", async () => {
    const { f1, r1, r2, t1 } = createFrameWithChildren();
    API.setSelectedElements([f1, r1, r2]);

    cut();

    assertElements(h.elements, [
      { id: f1.id, isDeleted: true },
      { id: r1.id, isDeleted: true },
      { id: r2.id, isDeleted: true },
      { id: t1.id, isDeleted: true },
    ]);
  });
});

describe("deleting points of an arrow in the line editor", () => {
  beforeEach(async () => {
    await render(<Excalidraw />);
  });

  const deletePoints = (
    arrow: NonDeleted<ExcalidrawArrowElement>,
    selectedPointsIndices: number[],
  ) => {
    API.setSelectedElements([arrow]);
    act(() => {
      h.setState({
        selectedLinearElement: {
          ...new LinearElementEditor(arrow, arrayToMap(h.elements)),
          isEditing: true,
          selectedPointsIndices,
        },
      });
    });
    act(() => {
      h.app.actionManager.executeAction(actionDeleteSelected);
    });
  };

  const setup = () => {
    const start = API.createElement({
      type: "rectangle",
      id: "start",
      x: -105,
      y: -50,
      boundElements: [{ type: "arrow", id: "arrow" }],
    });
    const end = API.createElement({
      type: "rectangle",
      id: "end",
      x: 300,
      y: -50,
      boundElements: [{ type: "arrow", id: "arrow" }],
    });
    const arrow = API.createElement({
      type: "arrow",
      id: "arrow",
      width: 295,
      height: 100,
      points: [pointFrom(0, 0), pointFrom(150, 100), pointFrom(295, 0)],
      startBinding: { elementId: "start", fixedPoint: [1, 0.5], mode: "orbit" },
      endBinding: { elementId: "end", fixedPoint: [0, 0.5], mode: "orbit" },
    }) as NonDeleted<ExcalidrawArrowElement>;
    API.setElements([start, end, arrow]);
    return arrow;
  };

  it("unbinds a deleted endpoint", async () => {
    const arrow = setup();

    deletePoints(arrow, [2]);

    expect(API.getElement(arrow)).toMatchObject({
      startBinding: { elementId: "start" },
      endBinding: null,
    });
    expect(API.getElement(arrow).points).toHaveLength(2);
    assertElements(h.elements, [
      { id: "start", boundElements: [{ type: "arrow", id: "arrow" }] },
      { id: "end", boundElements: [] },
      { id: "arrow", selected: true },
    ]);
  });

  it("keeps the bindings when deleting a midpoint", async () => {
    const arrow = setup();

    deletePoints(arrow, [1]);

    expect(API.getElement(arrow)).toMatchObject({
      startBinding: { elementId: "start" },
      endBinding: { elementId: "end" },
    });
  });
});

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

describe("deleting all points of an arrow in the line editor", () => {
  beforeEach(async () => {
    await render(<Excalidraw />);
  });

  it("deletes the arrow along with its label, and unbinds it", async () => {
    const rectangle = API.createElement({
      type: "rectangle",
      x: 300,
      y: -50,
      boundElements: [{ type: "arrow", id: "arrow" }],
    });
    const arrow = API.createElement({
      type: "arrow",
      id: "arrow",
      width: 295,
      height: 0,
      points: [pointFrom(0, 0), pointFrom(295, 0)],
      endBinding: {
        elementId: rectangle.id,
        fixedPoint: [0, 0.5],
        mode: "orbit",
      },
      boundElements: [{ type: "text", id: "label" }],
    });
    const label = API.createElement({
      type: "text",
      id: "label",
      containerId: arrow.id,
    });
    API.setElements([rectangle, arrow, label]);
    API.setSelectedElements([arrow]);
    act(() => {
      h.setState({
        selectedLinearElement: {
          ...new LinearElementEditor(
            arrow as NonDeleted<ExcalidrawArrowElement>,
            arrayToMap(h.elements),
          ),
          isEditing: true,
          selectedPointsIndices: [0, 1],
        },
      });
    });

    act(() => {
      h.app.actionManager.executeAction(actionDeleteSelected);
    });

    assertElements(h.elements, [
      { id: rectangle.id, isDeleted: false, boundElements: [] },
      { id: arrow.id, isDeleted: true },
      { id: label.id, isDeleted: true },
    ]);
    expect(h.state.selectedLinearElement).toBe(null);
  });
});

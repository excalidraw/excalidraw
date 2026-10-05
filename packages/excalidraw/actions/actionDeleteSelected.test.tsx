import React from "react";

import { Excalidraw } from "../index";
import { API } from "../tests/helpers/api";
import { act, assertElements, render } from "../tests/test-utils";

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

import React from "react";
import Scene from "../scene/Scene";
import { API } from "../tests/helpers/api";
import { Pointer, UI } from "../tests/helpers/ui";
import {
  fireEvent,
  GlobalTestState,
  queryByTestId,
  render,
} from "../tests/test-utils";
import { bindLinearElement } from "./binding";
import { Excalidraw } from "../index";
import { mutateElbowArrow } from "./routing";
import type {
  ExcalidrawArrowElement,
  ExcalidrawBindableElement,
  ExcalidrawElbowArrowElement,
} from "./types";
import { ARROW_TYPE } from "../constants";
import { pointFrom } from "../../math";

const { h } = window;

const mouse = new Pointer("mouse");

describe("elbow arrow routing", () => {
  it("can properly generate orthogonal arrow points", () => {
    const scene = new Scene();
    const arrow = API.createElement({
      type: "arrow",
      elbowed: true,
    }) as ExcalidrawElbowArrowElement;
    scene.insertElement(arrow);
    mutateElbowArrow(arrow, scene.getNonDeletedElementsMap(), [
      pointFrom(-45 - arrow.x, -100.1 - arrow.y),
      pointFrom(45 - arrow.x, 99.9 - arrow.y),
    ]);
    expect(arrow.points).toEqual([
      [0, 0],
      [0, 100],
      [90, 100],
      [90, 200],
    ]);
    expect(arrow.x).toEqual(-45);
    expect(arrow.y).toEqual(-100.1);
    expect(arrow.width).toEqual(90);
    expect(arrow.height).toEqual(200);
  });
  it("can generate proper points for bound elbow arrow", () => {
    const scene = new Scene();
    const rectangle1 = API.createElement({
      type: "rectangle",
      x: -150,
      y: -150,
      width: 100,
      height: 100,
    }) as ExcalidrawBindableElement;
    const rectangle2 = API.createElement({
      type: "rectangle",
      x: 50,
      y: 50,
      width: 100,
      height: 100,
    }) as ExcalidrawBindableElement;
    const arrow = API.createElement({
      type: "arrow",
      elbowed: true,
      x: -45,
      y: -100.1,
      width: 90,
      height: 200,
      points: [pointFrom(0, 0), pointFrom(90, 200)],
    }) as ExcalidrawElbowArrowElement;
    scene.insertElement(rectangle1);
    scene.insertElement(rectangle2);
    scene.insertElement(arrow);
    const elementsMap = scene.getNonDeletedElementsMap();
    bindLinearElement(arrow, rectangle1, "start", elementsMap);
    bindLinearElement(arrow, rectangle2, "end", elementsMap);

    expect(arrow.startBinding).not.toBe(null);
    expect(arrow.endBinding).not.toBe(null);

    mutateElbowArrow(arrow, elementsMap, [pointFrom(0, 0), pointFrom(90, 200)]);

    expect(arrow.points).toEqual([
      [0, 0],
      [45, 0],
      [45, 200],
      [90, 200],
    ]);
  });
});

describe("elbow arrow ui", () => {
  beforeEach(async () => {
    localStorage.clear();
    await render(<Excalidraw handleKeyboardGlobally={true} />);

    fireEvent.contextMenu(GlobalTestState.interactiveCanvas, {
      button: 2,
      clientX: 1,
      clientY: 1,
    });
    const contextMenu = UI.queryContextMenu();
    fireEvent.click(queryByTestId(contextMenu!, "stats")!);
  });

  it("can follow bound shapes", async () => {
    UI.createElement("rectangle", {
      x: -150,
      y: -150,
      width: 100,
      height: 100,
    });
    UI.createElement("rectangle", {
      x: 50,
      y: 50,
      width: 100,
      height: 100,
    });

    UI.clickTool("arrow");
    UI.clickOnTestId("elbow-arrow");

    expect(h.state.currentItemArrowType).toBe(ARROW_TYPE.elbow);

    mouse.reset();
    mouse.moveTo(-43, -99);
    mouse.click();
    mouse.moveTo(43, 99);
    mouse.click();

    const arrow = h.scene.getSelectedElements(
      h.state,
    )[0] as ExcalidrawArrowElement;

    expect(arrow.type).toBe("arrow");
    expect(arrow.elbowed).toBe(true);
    expect(arrow.points).toEqual([
      [0, 0],
      [45, 0],
      [45, 200],
      [90, 200],
    ]);
  });

  it("can follow bound rotated shapes", async () => {
    UI.createElement("rectangle", {
      x: -150,
      y: -150,
      width: 100,
      height: 100,
    });
    UI.createElement("rectangle", {
      x: 50,
      y: 50,
      width: 100,
      height: 100,
    });

    UI.clickTool("arrow");
    UI.clickOnTestId("elbow-arrow");

    mouse.reset();
    mouse.moveTo(-43, -99);
    mouse.click();
    mouse.moveTo(43, 99);
    mouse.click();

    const arrow = h.scene.getSelectedElements(
      h.state,
    )[0] as ExcalidrawArrowElement;

    mouse.click(51, 51);

    const inputAngle = UI.queryStatsProperty("A")?.querySelector(
      ".drag-input",
    ) as HTMLInputElement;
    UI.updateInput(inputAngle, String("40"));

    expect(arrow.points.map((point) => point.map(Math.round))).toEqual([
      [0, 0],
      [35, 0],
      [35, 90],
      [35, 90], // Note that coordinates are rounded above!
      [35, 165],
      [103, 165],
    ]);
  });

  // UI: snapping during dragging of cardinal angle 0° (horizontal right)
  it("snaps elbow arrow to discrete cardinal angles during drag", async () => {
    UI.clickTool("arrow");
    UI.clickOnTestId("elbow-arrow");

    expect(h.state.currentItemArrowType).toBe(ARROW_TYPE.elbow);
    
    mouse.reset();
    mouse.moveTo(0, 0);
    mouse.click();
    mouse.moveTo(30, 20);
    fireEvent.keyDown(document, { key: "Shift" }); // Enable snapping
    mouse.moveTo(50, 0); 
    fireEvent.keyUp(document, { key: "Shift" })
    mouse.click();
  
    const arrow = h.scene.getSelectedElements(h.state)[0] as ExcalidrawArrowElement;

    // Verify arrow only has two points
    expect(arrow.points.length).toBe(2);
  
    // Verify points snapped to 0°
    expect(arrow.points.map((point) => point.map(Math.round))).toEqual([
      [0, 0],   
      [50, 0],
    ]);
  });

  // UI: snapping during dragging of cardinal angle 90° (vertical upward)
  it("snaps elbow arrow to discrete cardinal angles during drag", async () => {
    UI.clickTool("arrow");
    UI.clickOnTestId("elbow-arrow");

    expect(h.state.currentItemArrowType).toBe(ARROW_TYPE.elbow);
    
    mouse.reset();
    mouse.moveTo(0, 0);
    mouse.click();
    mouse.moveTo(30, 20);
    fireEvent.keyDown(document, { key: "Shift" }); // Enable snapping
    mouse.moveTo(0, 50); 
    fireEvent.keyUp(document, { key: "Shift" })
    mouse.click();
  
    const arrow = h.scene.getSelectedElements(h.state)[0] as ExcalidrawArrowElement;

    // Verify arrow only has two points
    expect(arrow.points.length).toBe(2);
  
    // Verify points snapped to 90°
    expect(arrow.points.map((point) => point.map(Math.round))).toEqual([
      [0, 0],   
      [0, 50],
    ]);
  });

  // UI: snapping during dragging of cardinal angle 180° (horizontal left)
  it("snaps elbow arrow to discrete cardinal angles during drag", async () => {
    UI.clickTool("arrow");
    UI.clickOnTestId("elbow-arrow");

    expect(h.state.currentItemArrowType).toBe(ARROW_TYPE.elbow);
    
    mouse.reset();
    mouse.moveTo(0, 0);
    mouse.click();
    mouse.moveTo(30, 20);
    fireEvent.keyDown(document, { key: "Shift" }); // Enable snapping
    mouse.moveTo(-50, 0); 
    fireEvent.keyUp(document, { key: "Shift" })
    mouse.click();
  
    const arrow = h.scene.getSelectedElements(h.state)[0] as ExcalidrawArrowElement;

    // Verify arrow only has two points
    expect(arrow.points.length).toBe(2);
  
    // Verify points snapped to 180°
    expect(arrow.points.map((point) => point.map(Math.round))).toEqual([
      [0, 0],   
      [-50, 0],
    ]);
  });

  // UI: snapping during dragging of cardinal angle 270° (vertical downward)
  it("snaps elbow arrow to discrete cardinal angles during drag", async () => {
    UI.clickTool("arrow");
    UI.clickOnTestId("elbow-arrow");

    expect(h.state.currentItemArrowType).toBe(ARROW_TYPE.elbow);
    
    mouse.reset();
    mouse.moveTo(0, 0);
    mouse.click();
    mouse.moveTo(30, 20);
    fireEvent.keyDown(document, { key: "Shift" }); // Enable snapping
    mouse.moveTo(0, -50); 
    fireEvent.keyUp(document, { key: "Shift" })
    mouse.click();
  
    const arrow = h.scene.getSelectedElements(h.state)[0] as ExcalidrawArrowElement;

    // Verify arrow only has two points
    expect(arrow.points.length).toBe(2);
  
    // Verify points snapped to 270°
    expect(arrow.points.map((point) => point.map(Math.round))).toEqual([
      [0, 0],   
      [0, -50],
    ]);
  });

  // UI: snapping during dragging to nearest 15° angle
  it("snaps elbow arrow to discrete cardinal angles during drag", async () => {
    UI.clickTool("arrow");
    UI.clickOnTestId("elbow-arrow");

    expect(h.state.currentItemArrowType).toBe(ARROW_TYPE.elbow);
    
    mouse.reset();
    mouse.moveTo(0, 0);
    mouse.click();
    mouse.moveTo(30, 20);
    fireEvent.keyDown(document, { key: "Shift" }); // Enable snapping
    mouse.moveTo(50, 20); 
    fireEvent.keyUp(document, { key: "Shift" })
    mouse.click();
  
    const arrow = h.scene.getSelectedElements(h.state)[0] as ExcalidrawArrowElement;

    const snappedStart = arrow.points[0];
    const snappedEnd = arrow.points[1];

    // Calculate the snapped angle
    const deltaX = snappedEnd[0] - snappedStart[0];
    const deltaY = snappedEnd[1] - snappedStart[1];
    const angle = (Math.atan2(deltaY, deltaX) * 180) / Math.PI;

    // Verify the angle is a multiple of 15°
    expect(Math.round(angle / 15) * 15).toEqual(Math.round(angle));
  
  });
});
import React from "react";
import { expect } from "vitest";

import { reseed } from "@excalidraw/common";

import {
  getGlobalFixedPointForBindableElement,
  LinearElementEditor,
} from "@excalidraw/element";

import type {
  ExcalidrawBindableElement,
  ExcalidrawElbowArrowElement,
} from "@excalidraw/element/types";

import { Excalidraw } from "../index";

import { Pointer, UI } from "./helpers/ui";
import { render, unmountComponent } from "./test-utils";

const { h } = window;
const mouse = new Pointer("mouse");

unmountComponent();

beforeEach(() => {
  localStorage.clear();
  reseed(7);
});

test("unselected bound arrow updates when rotating its target element", async () => {
  await render(<Excalidraw />);
  const rectangle = UI.createElement("rectangle", {
    width: 200,
    height: 100,
  });
  const arrow = UI.createElement("arrow", {
    x: -80,
    y: 50,
    width: 85,
    height: 0,
  });

  expect(arrow.endBinding?.elementId).toEqual(rectangle.id);

  UI.rotate(rectangle, [60, 36], { shift: true });

  expect(arrow.endBinding?.elementId).toEqual(rectangle.id);
  expect(arrow.x).toBeCloseTo(-80);
  expect(arrow.y).toBeCloseTo(50);
  expect(arrow.width).toBeCloseTo(132.491, 1);
  expect(arrow.height).toBeCloseTo(82.267, 1);
});

test("unselected bound arrows update when rotating their target elements", async () => {
  await render(<Excalidraw />);
  const ellipse = UI.createElement("ellipse", {
    x: 0,
    y: 80,
    width: 300,
    height: 120,
  });
  const ellipseArrow = UI.createElement("arrow", {
    x: -10,
    y: 80,
    width: 50,
    height: 60,
  });
  const text = UI.createElement("text", {
    position: 220,
  });
  await UI.editText(text, "test");
  const textArrow = UI.createElement("arrow", {
    x: 360,
    y: 300,
    width: -140,
    height: -60,
  });

  expect(ellipseArrow.endBinding?.elementId).toEqual(ellipse.id);
  expect(textArrow.endBinding?.elementId).toEqual(text.id);

  UI.rotate([ellipse, text], [-82, 23], { shift: true });

  expect(ellipseArrow.endBinding?.elementId).toEqual(ellipse.id);
  expect(ellipseArrow.x).toEqual(-10);
  expect(ellipseArrow.y).toEqual(80);
  expect(ellipseArrow.points[0]).toEqual([0, 0]);
  expect(ellipseArrow.points[1][0]).toBeCloseTo(66.317, 1);
  expect(ellipseArrow.points[1][1]).toBeCloseTo(144.38, 1);

  expect(textArrow.endBinding?.elementId).toEqual(text.id);
  expect(textArrow.x).toEqual(360);
  expect(textArrow.y).toEqual(300);
  expect(textArrow.points[0]).toEqual([0, 0]);
  expect(textArrow.points[1][0]).toBeCloseTo(-95.4635969899922, 0);
  expect(textArrow.points[1][1]).toBeCloseTo(-126.8785027399889, 0);
});

test("elbow arrow in a rotated selection re-routes to its bound targets", async () => {
  await render(<Excalidraw />);
  const left = UI.createElement("rectangle", {
    x: 0,
    y: 0,
    width: 100,
    height: 100,
  });
  const right = UI.createElement("rectangle", {
    x: 300,
    y: 200,
    width: 100,
    height: 100,
  });

  UI.clickTool("arrow");
  UI.clickOnTestId("elbow-arrow");
  mouse.reset();
  mouse.moveTo(105, 50);
  mouse.click();
  mouse.moveTo(295, 250);
  mouse.click();

  const arrow = h.scene.getSelectedElements(
    h.state,
  )[0] as ExcalidrawElbowArrowElement;

  expect(arrow.startBinding?.elementId).toBe(left.id);
  expect(arrow.endBinding?.elementId).toBe(right.id);

  UI.rotate([left, right, arrow], [200, 100], { shift: true });

  expect(left.angle).not.toBe(0);
  expect(arrow.startBinding?.elementId).toBe(left.id);
  expect(arrow.endBinding?.elementId).toBe(right.id);

  // both endpoints sit on the fixed points of the rotated targets
  const elementsMap = h.scene.getNonDeletedElementsMap();
  for (const [index, binding, target] of [
    [0, arrow.startBinding!, left],
    [-1, arrow.endBinding!, right],
  ] as const) {
    const endpoint = LinearElementEditor.getPointAtIndexGlobalCoordinates(
      arrow,
      index,
      elementsMap,
    );
    const fixedPoint = getGlobalFixedPointForBindableElement(
      binding.fixedPoint,
      target as ExcalidrawBindableElement,
      elementsMap,
    );
    expect(endpoint[0]).toBeCloseTo(fixedPoint[0], 0);
    expect(endpoint[1]).toBeCloseTo(fixedPoint[1], 0);
  }

  // and the route stays orthogonal
  expect(
    arrow.points
      .slice(1)
      .every(
        ([x, y], i) =>
          Math.abs(x - arrow.points[i][0]) < 1 ||
          Math.abs(y - arrow.points[i][1]) < 1,
      ),
  ).toBe(true);
});

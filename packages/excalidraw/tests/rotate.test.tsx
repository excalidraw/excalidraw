import React from "react";
import { expect } from "vitest";

import { arrayToMap, reseed } from "@excalidraw/common";
import {
  getElementAbsoluteCoords,
  getTransformHandles,
} from "@excalidraw/element";

import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { UI } from "./helpers/ui";
import { render, unmountComponent } from "./test-utils";

unmountComponent();

const { h } = window;

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

test("arrow with an off-center label doesn't jump when rotation starts", async () => {
  await render(<Excalidraw handleKeyboardGlobally={true} />);
  const arrow = UI.createElement("arrow", {
    x: 0,
    y: 0,
    width: 100,
    height: 0,
  });
  const label = await UI.editText(
    arrow,
    "a long label that sticks out past the arrow",
  );
  // move the label towards the arrow's start, so the selection bounds
  // (which include the label) are no longer centered on the arrow
  API.updateElement(label.get(), { labelPosition: 0.1 });

  const elementsMap = arrayToMap(h.elements);
  const [, , , , cx] = getElementAbsoluteCoords(arrow.get(), elementsMap);
  const [x, , width] = getTransformHandles(
    arrow.get(),
    h.state.zoom,
    elementsMap,
    "mouse",
  ).rotation!;

  // the rotation handle must sit on the axis the arrow rotates around
  expect(x + width / 2).toBeCloseTo(cx);

  // grabbing the handle and nudging it shouldn't snap the arrow to a new angle
  UI.rotate(arrow, [1, 0]);
  const angle = arrow.angle;
  expect(Math.min(angle, 2 * Math.PI - angle)).toBeLessThan(0.1);
});

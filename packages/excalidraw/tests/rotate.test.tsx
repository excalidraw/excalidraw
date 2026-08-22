import React from "react";
import { expect } from "vitest";

import { arrayToMap, reseed } from "@excalidraw/common";
import { getTransformHandles } from "@excalidraw/element";

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

test("rotates exactly to 90 degrees in grid mode", async () => {
  await render(<Excalidraw />);
  API.setAppState({ gridModeEnabled: true });

  const rectangle = API.createElement({
    type: "rectangle",
    x: 100,
    y: 103,
    width: 80,
    height: 40,
  });
  API.setElements([rectangle]);

  const rotationHandle = getTransformHandles(
    rectangle,
    h.state.zoom,
    arrayToMap(h.elements),
    "mouse",
    {},
  ).rotation!;

  const handleCenterX = rotationHandle[0] + rotationHandle[2] / 2;
  const handleCenterY = rotationHandle[1] + rotationHandle[3] / 2;
  const elementCenterX = rectangle.x + rectangle.width / 2;
  const elementCenterY = rectangle.y + rectangle.height / 2;

  UI.rotate(rectangle, [
    elementCenterX + 100 - handleCenterX,
    elementCenterY - handleCenterY,
  ]);

  expect(API.getElement(rectangle).angle).toBeCloseTo(Math.PI / 2);
});

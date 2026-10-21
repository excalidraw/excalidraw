import React from "react";

import { CaptureUpdateAction, isLinearElement } from "@excalidraw/element";
import { restoreLinearElementAnimation } from "@excalidraw/element/linearElementAnimation";

import { pointFrom } from "@excalidraw/math";

import type { LocalPoint } from "@excalidraw/math";

import type { ExcalidrawLinearElement } from "@excalidraw/element/types";

import { Excalidraw } from "../index";
import { serializeAsJSON } from "../data/json";
import { restoreElements } from "../data/restore";
import { actionChangeLinearAnimation } from "../actions/actionLinearAnimation";
import { getAnimationPath } from "../components/canvases/LinearAnimationOverlay";

import { createUndoAction, createRedoAction } from "../actions/actionHistory";

import { API } from "./helpers/api";

import {
  act,
  render,
  fireEvent,
  screen,
  GlobalTestState,
  unmountComponent,
} from "./test-utils";

const { h } = window;
const animation = { type: "dots", speed: 2, direction: "reverse" } as const;

const changeAnimation = (value: typeof animation | null) =>
  act(() => {
    h.app.actionManager.executeAction(
      actionChangeLinearAnimation,
      "contextMenu",
      value,
    );
  });

afterEach(() => unmountComponent());

const currentLine = () => h.elements[0] as ExcalidrawLinearElement;

beforeEach(async () => {
  await render(<Excalidraw handleKeyboardGlobally={true} />);
});

it("round trips animation JSON while keeping legacy elements static", () => {
  const arrow = API.createElement({ type: "arrow" });
  const line = API.createElement({ type: "line" });
  const animated = { ...arrow, animation };
  const json = serializeAsJSON([animated, line], h.state, {}, "local");
  const restored = restoreElements(JSON.parse(json).elements, null);
  expect(isLinearElement(restored[0]) && restored[0].animation).toEqual(
    animation,
  );
  expect(restored[1]).not.toHaveProperty("animation");
  expect(
    JSON.parse(serializeAsJSON(restored, h.state, {}, "local")).elements[0]
      .animation,
  ).toEqual(animation);
});

it.each([
  undefined,
  null,
  true,
  "dots",
  {},
  { ...animation, speed: 0 },
  { ...animation, speed: Infinity },
  { ...animation, type: "future" },
  { ...animation, direction: "bad" },
])("ignores invalid animation %j", (value) => {
  expect(restoreLinearElementAnimation(value)).toBeNull();
  const arrow = API.createElement({ type: "arrow" });
  const [restored] = restoreElements(
    [{ ...arrow, animation: value } as any],
    null,
  );
  expect(isLinearElement(restored) && restored.animation == null).toBe(true);
  expect(restored.points).toEqual(arrow.points);
});

it("supports undo, redo, and disabling without changing geometry or unrelated elements", () => {
  const arrow = API.createElement({ type: "arrow" });
  const line = API.createElement({ type: "line", locked: true });
  const rectangle = API.createElement({ type: "rectangle" });
  API.updateScene({
    elements: [arrow, line, rectangle],
    captureUpdate: CaptureUpdateAction.NEVER,
  });
  API.setSelectedElements([arrow, line, rectangle]);
  changeAnimation(animation);
  expect(currentLine().animation).toEqual(animation);
  expect(currentLine().points).toEqual(arrow.points);
  expect(h.elements[1]).toBe(line);
  expect(h.elements[2]).toBe(rectangle);
  API.executeAction(createUndoAction(h.history));
  expect(currentLine().animation == null).toBe(true);
  API.executeAction(createRedoAction(h.history));
  expect(currentLine().animation).toEqual(animation);
  changeAnimation(null);
  expect(currentLine().animation).toBeNull();
});

it("opens Animate from a line's context menu and applies all controls", () => {
  const line = API.createElement({
    type: "line",
    x: 200,
    y: 200,
    width: 100,
    height: 0,
    points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(100, 0)],
  });
  API.setElements([line]);
  API.setSelectedElements([line]);
  fireEvent.contextMenu(GlobalTestState.interactiveCanvas, {
    button: 2,
    clientX: 250,
    clientY: 200,
  });
  fireEvent.click(screen.getByRole("button", { name: /Animate/ }));
  const type = screen.getByRole("combobox", { name: "Animation type" });
  fireEvent.change(type, { target: { value: "dashes" } });
  fireEvent.change(screen.getByRole("combobox", { name: "Speed" }), {
    target: { value: "2" },
  });
  fireEvent.change(screen.getByRole("combobox", { name: "Direction" }), {
    target: { value: "reverse" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Apply" }));
  expect(currentLine().animation).toEqual({
    type: "dashes",
    speed: 2,
    direction: "reverse",
  });
  fireEvent.contextMenu(GlobalTestState.interactiveCanvas, {
    button: 2,
    clientX: 250,
    clientY: 200,
  });
  fireEvent.click(screen.getByRole("button", { name: /Animate/ }));
  fireEvent.change(screen.getByRole("combobox", { name: "Animation type" }), {
    target: { value: "none" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Apply" }));
  expect(currentLine().animation).toBeNull();
});

it("does not change animations in view mode", () => {
  const arrow = API.createElement({ type: "arrow" });
  API.setElements([arrow]);
  API.setSelectedElements([arrow]);
  API.setAppState({ viewModeEnabled: true });
  changeAnimation(animation);
  expect(h.elements[0]).toBe(arrow);
});

it("uses a continuous rendered shaft for straight, curved, and elbow arrows", () => {
  for (const element of [
    API.createElement({
      type: "line",
      points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(100, 0)],
    }),
    API.createElement({
      type: "arrow",
      points: [
        pointFrom<LocalPoint>(0, 0),
        pointFrom<LocalPoint>(50, 80),
        pointFrom<LocalPoint>(100, 0),
      ],
      roundness: { type: 2 },
    }),
    API.createElement({
      type: "arrow",
      elbowed: true,
      points: [
        pointFrom<LocalPoint>(0, 0),
        pointFrom<LocalPoint>(50, 0),
        pointFrom<LocalPoint>(50, 100),
        pointFrom<LocalPoint>(100, 100),
      ],
    }),
  ]) {
    const path = getAnimationPath(element);
    expect(path.startsWith("M")).toBe(true);
    expect(path.match(/M/g)).toHaveLength(1);
    expect(path).not.toMatch(/NaN|Infinity/);
  }
});

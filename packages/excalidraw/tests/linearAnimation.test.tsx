import React from "react";
import { vi } from "vitest";

import {
  CaptureUpdateAction,
  LinearElementEditor,
  isLinearElement,
} from "@excalidraw/element";
import {
  getAnimationProgress,
  restoreLinearElementAnimation,
} from "@excalidraw/element/linearElementAnimation";

import { pointFrom } from "@excalidraw/math";

import type { LocalPoint } from "@excalidraw/math";

import type { ExcalidrawLinearElement } from "@excalidraw/element/types";

import * as StaticScene from "../renderer/staticScene";

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
const animation = {
  type: "dot",
  count: 3,
  speed: 0.75,
  size: 12,
  direction: "reverse",
} as const;

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
  { ...animation, speed: -0.01 },
  { ...animation, speed: 1.01 },
  { ...animation, speed: NaN },
  { ...animation, size: 0 },
  { ...animation, size: 101 },
  { ...animation, size: Infinity },
  { ...animation, size: null },
  { ...animation, count: 0 },
  { ...animation, count: 21 },
  { ...animation, count: 1.5 },
  { ...animation, count: NaN },
  { ...animation, count: null },
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
  fireEvent.change(screen.getByRole("slider", { name: "Speed" }), {
    target: { value: "0.75" },
  });
  fireEvent.keyDown(screen.getByRole("slider", { name: "Speed" }), {
    key: "ArrowLeft",
  });
  expect(screen.getByRole("slider", { name: "Speed" })).toBeInTheDocument();
  fireEvent.change(screen.getByRole("slider", { name: "Size" }), {
    target: { value: "24" },
  });
  fireEvent.change(screen.getByRole("spinbutton", { name: "Size value" }), {
    target: { value: "18" },
  });
  expect(screen.getByRole("slider", { name: "Size" })).toHaveValue("18");
  fireEvent.change(screen.getByRole("combobox", { name: "Direction" }), {
    target: { value: "reverse" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Apply" }));
  expect(currentLine().animation).toEqual({
    type: "dashes",
    count: 1,
    speed: 0.75,
    size: 18,
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

it.each(["dot", "gap", "dashes", "pulse"] as const)(
  "round trips %s with paused and fractional speed and custom size",
  (type) => {
    for (const speed of [0, 0.01, 0.5, 1]) {
      const value = {
        type,
        count: 4,
        speed,
        size: 37,
        direction: "forward" as const,
      };
      const element = {
        ...API.createElement({ type: "arrow" }),
        animation: value,
      };
      const [restored] = restoreElements(
        JSON.parse(serializeAsJSON([element], h.state, {}, "local")).elements,
        null,
      );
      expect(isLinearElement(restored) && restored.animation).toEqual(value);
    }
  },
);

it.each([
  [0.5, 0.25],
  [1, 0.5],
  [2, 1],
])(
  "migrates original speed %s without losing motion settings",
  (oldSpeed, newSpeed) => {
    expect(
      restoreLinearElementAnimation({
        type: "dots",
        speed: oldSpeed,
        direction: "reverse",
      }),
    ).toEqual({
      type: "dot",
      count: 8,
      speed: newSpeed,
      size: 8,
      direction: "reverse",
    });
  },
);

it("pauses at zero and reverses the traveling gap", () => {
  const value = {
    type: "gap",
    count: 1,
    speed: 0.5,
    size: 20,
    direction: "forward",
  } as const;
  expect(getAnimationProgress(1250, value)).toBeCloseTo(0.25);
  expect(
    getAnimationProgress(1250, { ...value, direction: "reverse" }),
  ).toBeCloseTo(0.75);
  expect(getAnimationProgress(9000, { ...value, speed: 0 })).toBe(0);
  expect(
    getAnimationProgress(9000, { ...value, speed: 0, direction: "reverse" }),
  ).toBe(1);
});

it("draws a single traveling dot, with editable diameter and a paused clock", () => {
  const element = API.createElement({ type: "arrow" });
  API.setElements([
    {
      ...element,
      animation: {
        type: "dot",
        count: 1,
        speed: 0,
        size: 19,
        direction: "forward",
      },
    },
  ]);
  const dot = document.querySelector(".linear-animation-dot");
  expect(dot).toHaveAttribute("pathLength", "1");
  expect(dot).toHaveAttribute("stroke-dasharray", "0.000001 1");
  expect(dot).toHaveAttribute("stroke-width", "19");
  expect(dot).toHaveStyle({ animationPlayState: "paused" });
});

it("cuts a traveling gap only from its own bitmap, preserving normal export", () => {
  const renderer = vi.spyOn(StaticScene, "renderStaticScene");
  const arrow = API.createElement({ type: "arrow" });
  API.setElements([
    {
      ...arrow,
      animation: {
        type: "gap",
        count: 3,
        speed: 0,
        size: 50,
        direction: "forward",
      },
    },
  ]);
  const config = renderer.mock.calls.find(
    ([config]) => config.renderConfig.linearAnimationTime !== undefined,
  )![0];
  expect(config).toBeDefined();
  expect(document.querySelector(".linear-animation-gap")).toBeNull();
  const context = config.canvas.getContext("2d")!;
  const clip = vi.spyOn(context, "clip");
  const arc = vi.spyOn(context, "arc");
  const point = vi.spyOn(LinearElementEditor, "getPointAtPathParameter");
  clip.mockClear();
  arc.mockClear();
  StaticScene.renderStaticScene(
    {
      ...config,
      renderConfig: { ...config.renderConfig, linearAnimationTime: 1250 },
    },
    false,
  );
  expect(point).toHaveBeenCalledWith(
    expect.objectContaining({ id: arrow.id }),
    0,
    expect.any(Map),
  );
  expect(point).toHaveBeenCalledTimes(3);
  point.mock.calls.forEach(([, progress], index) =>
    expect(progress).toBeCloseTo(index / 3),
  );
  expect(clip).toHaveBeenCalledTimes(3);
  expect(clip).toHaveBeenCalledWith("evenodd");
  expect(arc).toHaveBeenCalledWith(
    expect.any(Number),
    expect.any(Number),
    25 * config.scale,
    0,
    Math.PI * 2,
  );
  point.mockClear();
  StaticScene.renderStaticScene(
    {
      ...config,
      renderConfig: {
        ...config.renderConfig,
        isExporting: true,
        linearAnimationTime: 1250,
      },
    },
    false,
  );
  expect(point).not.toHaveBeenCalled();
  point.mockRestore();
  clip.mockRestore();
  arc.mockRestore();
  renderer.mockRestore();
});

it.each([1, 4, 20])("renders exactly %s evenly spaced dots", (count) => {
  const arrow = API.createElement({ type: "arrow" });
  API.setElements([
    {
      ...arrow,
      animation: {
        type: "dot",
        count,
        size: 8,
        speed: 0.5,
        direction: "forward",
      },
    },
  ]);
  const dots = document.querySelectorAll<SVGPathElement>(
    ".linear-animation-dot",
  );
  expect(dots).toHaveLength(count);
  dots.forEach((dot, index) =>
    expect(dot.style.animationDelay).toBe(`${(-5 * index) / count}s`),
  );
});

it.each([
  ["dot", "dot", 1],
  ["dots", "dot", 8],
  ["gap", "gap", 1],
  ["gaps", "gap", 8],
])(
  "migrates the previous %s option into %s and count",
  (oldType, type, count) => {
    expect(
      restoreLinearElementAnimation({
        type: oldType,
        size: 16,
        speed: 0.4,
        direction: "forward",
      }),
    ).toEqual({ type, count, size: 16, speed: 0.4, direction: "forward" });
  },
);

it("keeps multiple paused gaps evenly spaced in either direction", () => {
  const value = {
    type: "gap",
    count: 4,
    size: 20,
    speed: 0,
    direction: "forward",
  } as const;
  expect(
    [0, 1, 2, 3].map((index) => getAnimationProgress(8000, value, index)),
  ).toEqual([0, 0.25, 0.5, 0.75]);
  expect(
    [0, 1, 2, 3].map((index) =>
      getAnimationProgress(8000, { ...value, direction: "reverse" }, index),
    ),
  ).toEqual([1, 0.75, 0.5, 0.25]);
});

it("offers one dot/gap choice and an integer count slider that persists in JSON", () => {
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
  expect(
    screen.getAllByRole("option").map((option) => option.textContent),
  ).not.toContain("Traveling dots");
  const type = screen.getByRole("combobox", { name: "Animation type" });
  fireEvent.change(type, { target: { value: "dot" } });
  const count = screen.getByRole("slider", { name: "Count" });
  expect(count).toHaveAttribute("step", "1");
  expect(count).toHaveAttribute("min", "1");
  expect(count).toHaveAttribute("max", "20");
  fireEvent.change(count, { target: { value: "4" } });
  fireEvent.keyDown(count, { key: "ArrowLeft" });
  fireEvent.change(type, { target: { value: "gap" } });
  expect(screen.getByRole("slider", { name: "Count" })).toHaveValue("4");
  fireEvent.click(screen.getByRole("button", { name: "Apply" }));
  expect(currentLine().animation).toMatchObject({ type: "gap", count: 4 });
  const json = JSON.parse(serializeAsJSON(h.elements, h.state, {}, "local"));
  expect(json.elements[0].animation.count).toBe(4);
});

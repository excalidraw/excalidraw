import { vi } from "vitest";

import { arrayToMap, THEME } from "@excalidraw/common";
import { pointFrom, type GlobalPoint } from "@excalidraw/math";

import {
  getReferenceSnapPoints,
  getVisibleGaps,
  SnapCache,
  snapDraggedElements,
} from "../snapping";
import { getDefaultAppState } from "../appState";
import { renderSnaps } from "../renderer/renderSnaps";

import { API } from "./helpers/api";

import type {
  AppClassProperties,
  AppState,
  InteractiveCanvasAppState,
  KeyboardModifiersObject,
} from "../types";

const event: KeyboardModifiersObject = {
  altKey: false,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
};

const getAppState = (overrides: Partial<AppState> = {}): AppState =>
  ({
    ...getDefaultAppState(),
    width: 1000,
    height: 1000,
    offsetLeft: 0,
    offsetTop: 0,
    ...overrides,
  } as AppState);

describe("object snapping", () => {
  afterEach(() => {
    SnapCache.destroy();
    vi.restoreAllMocks();
  });

  it("snaps dragged elements to match existing horizontal spacing", () => {
    const left = API.createElement({
      id: "left",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    });
    const middle = API.createElement({
      id: "middle",
      x: 130,
      y: 0,
      width: 100,
      height: 100,
    });
    const moving = API.createElement({
      id: "moving",
      x: 258,
      y: 0,
      width: 100,
      height: 100,
    });
    const elements = [left, middle, moving];
    const selectedElements = [moving];
    const appState = getAppState({
      objectsSnapModeEnabled: true,
      selectedElementIds: {
        [moving.id]: true,
      },
    });
    const elementsMap = arrayToMap(elements);
    const app = {
      props: {},
      state: appState,
    } as AppClassProperties;

    SnapCache.setReferenceSnapPoints(
      getReferenceSnapPoints(elements, selectedElements, appState, elementsMap),
    );
    SnapCache.setVisibleGaps(
      getVisibleGaps(elements, selectedElements, appState, elementsMap),
    );

    const { snapOffset, snapLines } = snapDraggedElements(
      elements,
      { x: 0, y: 0 },
      app,
      event,
      elementsMap,
    );

    expect(snapOffset).toEqual({ x: 2, y: 0 });
    expect(snapLines.filter((snapLine) => snapLine.type === "gap")).toEqual([
      {
        type: "gap",
        direction: "horizontal",
        points: [
          pointFrom<GlobalPoint>(100, 50),
          pointFrom<GlobalPoint>(130, 50),
        ],
      },
      {
        type: "gap",
        direction: "horizontal",
        points: [
          pointFrom<GlobalPoint>(230, 50),
          pointFrom<GlobalPoint>(260, 50),
        ],
      },
    ]);
  });

  it("renders distance labels for gap snap lines", () => {
    const context = document.createElement("canvas").getContext("2d")!;
    const fillText = vi.spyOn(context, "fillText");

    renderSnaps(context, {
      ...getAppState({
        snapLines: [
          {
            type: "gap",
            direction: "horizontal",
            points: [
              pointFrom<GlobalPoint>(100, 50),
              pointFrom<GlobalPoint>(130, 50),
            ],
          },
          {
            type: "gap",
            direction: "vertical",
            points: [
              pointFrom<GlobalPoint>(50, 100),
              pointFrom<GlobalPoint>(50, 130),
            ],
          },
        ],
        theme: THEME.LIGHT,
      }),
    } as InteractiveCanvasAppState);

    expect(fillText).toHaveBeenCalledWith(
      "30",
      expect.any(Number),
      expect.any(Number),
    );
    expect(fillText).toHaveBeenCalledTimes(2);
  });

  it("does not render distance labels in zen mode", () => {
    const context = document.createElement("canvas").getContext("2d")!;
    const fillText = vi.spyOn(context, "fillText");

    renderSnaps(context, {
      ...getAppState({
        snapLines: [
          {
            type: "gap",
            direction: "horizontal",
            points: [
              pointFrom<GlobalPoint>(100, 50),
              pointFrom<GlobalPoint>(130, 50),
            ],
          },
        ],
        theme: THEME.LIGHT,
        zenModeEnabled: true,
      }),
    } as InteractiveCanvasAppState);

    expect(fillText).not.toHaveBeenCalled();
  });
});

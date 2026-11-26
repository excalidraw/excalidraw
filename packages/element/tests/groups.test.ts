import { arrayToMap } from "@excalidraw/common";

import { getDefaultAppState } from "@excalidraw/excalidraw/appState";

import { getElementsInResizingFrame } from "../src/frame";
import { selectGroupsFromGivenElements } from "../src/groups";
import { newElement, newFrameElement } from "../src/newElement";

const appState = () => ({
  ...getDefaultAppState(),
  width: 1000,
  height: 1000,
  offsetLeft: 0,
  offsetTop: 0,
});

const rectangle = (id: string, groupIds: string[]) => ({
  ...newElement({
    type: "rectangle",
    x: 10,
    y: 10,
    width: 10,
    height: 10,
    groupIds,
  }),
  id,
});

describe("selectGroupsFromGivenElements", () => {
  it("does not repeatedly scan already selected groups during frame dragging", () => {
    let groupReads = 0;
    const elements = Array.from({ length: 400 }, (_, index) => {
      const element = rectangle(`element-${index}`, [`group-${index % 4}`]);
      const groupIds = element.groupIds;
      Object.defineProperty(element, "groupIds", {
        get: () => {
          groupReads++;
          return groupIds;
        },
      });
      return element;
    });
    const frame = newFrameElement({ x: 0, y: 0, width: 100, height: 100 });
    const scene = [...elements, frame];
    const highlighted = getElementsInResizingFrame(
      scene,
      frame,
      appState(),
      arrayToMap(scene),
    );

    expect(highlighted.map((element) => element.id).sort()).toEqual(
      elements.map((element) => element.id).sort(),
    );
    // Bound the work rather than elapsed time, which varies with machine load.
    expect(groupReads).toBeLessThan(elements.length * 40);
  });

  it("preserves nested group selection while editing a group", () => {
    const elements = [
      rectangle("a", ["inner", "outer"]),
      rectangle("b", ["inner", "outer"]),
      rectangle("c", ["other", "outer"]),
      rectangle("d", ["other", "outer"]),
    ];
    const state = appState();

    expect(selectGroupsFromGivenElements(elements, state)).toEqual({
      outer: true,
    });
    expect(
      selectGroupsFromGivenElements(elements, {
        ...state,
        editingGroupId: "outer",
      }),
    ).toEqual({ inner: true, other: true });
    expect(state.selectedElementIds).toEqual({});
    expect(state.selectedGroupIds).toEqual({});
  });

  it("does not select singleton or ungrouped candidates", () => {
    expect(
      selectGroupsFromGivenElements(
        [rectangle("a", ["singleton"]), rectangle("b", [])],
        appState(),
      ),
    ).toEqual({});
  });
});

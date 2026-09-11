import { pointFrom } from "@excalidraw/math";

import { newElement } from "@excalidraw/element";

import type { ElementsMap } from "@excalidraw/element/types";

import { getDefaultAppState } from "../../appState";

import { isPointHittingLink } from "./helpers";

import type { AppState } from "../../types";

// getDefaultAppState() omits the viewport-derived fields (they are only
// known once the editor has mounted); fill in fixed values for the test.
const createAppState = (overrides: Partial<AppState> = {}): AppState => ({
  ...getDefaultAppState(),
  width: 1000,
  height: 800,
  offsetTop: 0,
  offsetLeft: 0,
  ...overrides,
});

// Uses real elements and the real hit-test logic (getElementAbsoluteCoords /
// hitElementBoundingBox) instead of mocking @excalidraw/element, matching
// how the other tests in this directory (e.g.
// positionElementBesideCursor.test.ts) exercise real implementations rather
// than mocks. See STYLE.md for the reasoning.
const createLinkedRectangle = () =>
  newElement({
    type: "rectangle",
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    link: "https://example.com",
  });

const createElementsMap = (
  ...elements: ReturnType<typeof createLinkedRectangle>[]
): ElementsMap => new Map(elements.map((element) => [element.id, element]));

describe("isPointHittingLink", () => {
  it("returns false when the element has no link", () => {
    const element = { ...createLinkedRectangle(), link: null };
    const elementsMap = createElementsMap(element);
    const appState = createAppState({ viewModeEnabled: true });

    expect(
      isPointHittingLink(
        element,
        elementsMap,
        appState,
        pointFrom(50, 50),
        true,
      ),
    ).toBe(false);
  });

  it("returns false when the element is currently selected", () => {
    const element = createLinkedRectangle();
    const elementsMap = createElementsMap(element);
    const appState = createAppState({
      viewModeEnabled: true,
      selectedElementIds: { [element.id]: true },
    });

    expect(
      isPointHittingLink(
        element,
        elementsMap,
        appState,
        pointFrom(50, 50),
        true,
      ),
    ).toBe(false);
  });

  it("regression #9637: hitting anywhere on the element body opens the link on mobile in view mode", () => {
    // Previously `!isMobile && appState.viewModeEnabled && ...` excluded
    // mobile from the "whole bounding box is clickable" path, so on mobile
    // only the small link icon (not the element body) was clickable.
    const element = createLinkedRectangle();
    const elementsMap = createElementsMap(element);
    const appState = createAppState({ viewModeEnabled: true });

    expect(
      isPointHittingLink(
        element,
        elementsMap,
        appState,
        pointFrom(50, 50),
        true,
      ),
    ).toBe(true);
  });

  it("still hits anywhere on the element body on desktop in view mode (unchanged behavior)", () => {
    const element = createLinkedRectangle();
    const elementsMap = createElementsMap(element);
    const appState = createAppState({ viewModeEnabled: true });

    expect(
      isPointHittingLink(
        element,
        elementsMap,
        appState,
        pointFrom(50, 50),
        false,
      ),
    ).toBe(true);
  });

  it("outside view mode, only the link icon is hit, on both mobile and desktop", () => {
    const element = createLinkedRectangle();
    const elementsMap = createElementsMap(element);
    const appState = createAppState({ viewModeEnabled: false });

    // center of the element body: not the link icon location
    expect(
      isPointHittingLink(
        element,
        elementsMap,
        appState,
        pointFrom(50, 50),
        true,
      ),
    ).toBe(false);
    expect(
      isPointHittingLink(
        element,
        elementsMap,
        appState,
        pointFrom(50, 50),
        false,
      ),
    ).toBe(false);
  });
});

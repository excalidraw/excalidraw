import { arrayToMap } from "@excalidraw/common";
import { getDefaultAppState } from "@excalidraw/excalidraw/appState";
import { API } from "@excalidraw/excalidraw/tests/helpers/api";

import type { EditorInterface } from "@excalidraw/common";
import type {
  AppState,
  NormalizedZoomValue,
} from "@excalidraw/excalidraw/types";

import { resizeTest } from "../src/resizeTest";
import {
  canResizeFromSides,
  getOmitSidesForEditorInterface,
  getTransformHandles,
} from "../src/transformHandles";

const createEditorInterface = (
  overrides: Partial<{
    formFactor: EditorInterface["formFactor"];
    isMobileDevice: boolean;
    isTouchScreen: boolean;
  }>,
) =>
  ({
    formFactor: overrides.formFactor ?? "desktop",
    isTouchScreen: overrides.isTouchScreen ?? false,
    userAgent: {
      isMobileDevice: overrides.isMobileDevice ?? false,
      platform: "unknown",
    },
  } as EditorInterface);

describe("canResizeFromSides", () => {
  it("should allow resizing from sides on desktop", () => {
    expect(canResizeFromSides(createEditorInterface({}))).toBe(true);
    expect(
      canResizeFromSides(createEditorInterface({ isTouchScreen: true })),
    ).toBe(true);
    expect(
      canResizeFromSides(createEditorInterface({ formFactor: "phone" })),
    ).toBe(true);
  });

  it("should not allow resizing from sides on mobile phones", () => {
    expect(
      canResizeFromSides(
        createEditorInterface({ formFactor: "phone", isMobileDevice: true }),
      ),
    ).toBe(false);
  });

  it("should not allow resizing from sides on touch tablets", () => {
    expect(
      canResizeFromSides(
        createEditorInterface({
          formFactor: "tablet",
          isMobileDevice: true,
          isTouchScreen: true,
        }),
      ),
    ).toBe(false);
    expect(
      canResizeFromSides(
        createEditorInterface({
          formFactor: "desktop",
          isMobileDevice: true,
          isTouchScreen: true,
        }),
      ),
    ).toBe(false);
  });

  it("should allow resizing from sides on tablets before touch input", () => {
    expect(
      canResizeFromSides(
        createEditorInterface({ formFactor: "tablet", isMobileDevice: true }),
      ),
    ).toBe(true);
  });
});

describe("text side handles", () => {
  const zoom = { value: 1 as NormalizedZoomValue };
  const touchTablet = createEditorInterface({
    formFactor: "tablet",
    isMobileDevice: true,
    isTouchScreen: true,
  });

  const createSingleLineText = () =>
    API.createElement({
      type: "text",
      text: "Hello world",
      x: 0,
      y: 0,
      width: 120,
      height: 25,
    });

  it("should show w/e handles on single-line text", () => {
    const text = createSingleLineText();
    const handles = getTransformHandles(
      text,
      zoom,
      arrayToMap([text]),
      "touch",
      getOmitSidesForEditorInterface(touchTablet),
    );

    expect(handles.w).toBeDefined();
    expect(handles.e).toBeDefined();
  });

  it("should not show w/e handles on other short elements", () => {
    const rectangle = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 120,
      height: 25,
    });
    const handles = getTransformHandles(
      rectangle,
      zoom,
      arrayToMap([rectangle]),
      "touch",
      getOmitSidesForEditorInterface(touchTablet),
    );

    expect(handles.w).toBeUndefined();
    expect(handles.e).toBeUndefined();
  });

  it("should pick the closest handle when touch handles overlap", () => {
    const text = createSingleLineText();
    const appState = {
      ...getDefaultAppState(),
      selectedElementIds: { [text.id]: true },
    } as AppState;
    const [x, y, width, height] = getTransformHandles(
      text,
      zoom,
      arrayToMap([text]),
      "touch",
      getOmitSidesForEditorInterface(touchTablet),
    ).e!;

    // slightly above the e handle's center, where the ne handle overlaps it
    expect(
      resizeTest(
        text,
        arrayToMap([text]),
        appState,
        x + width / 2,
        y + height / 2 - 6,
        zoom,
        "touch",
        touchTablet,
      ),
    ).toBe("e");
  });
});

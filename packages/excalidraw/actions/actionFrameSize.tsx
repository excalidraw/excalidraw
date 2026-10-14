import { arrayToMap, updateActiveTool } from "@excalidraw/common";

import {
  CaptureUpdateAction,
  getElementsInResizingFrame,
  newElementWith,
  newFrameElement,
  replaceAllElementsInFrame,
  sortFramesInReadingOrder,
  syncMovedIndices,
} from "@excalidraw/element";

import { FrameSizePanel } from "../components/FrameSize/FrameSizePanel";
import { zoomToFitBounds } from "../viewport";

import { getSingleSelectedFrame } from "./actionFrame";
import { register } from "./register";

import type { FrameSize } from "../components/FrameSize/framePresets";
import type { AppClassProperties, AppState } from "../types";

/** gap between a new frame and the last one, so slides line up in a row */
const NEW_FRAME_GAP = 100;

/** places a new frame after the last slide, or in the viewport center */
const getNewFramePosition = (
  { width, height }: FrameSize,
  appState: AppState,
  app: AppClassProperties,
) => {
  const lastSlide = sortFramesInReadingOrder(
    app.scene.getNonDeletedFramesLikes(),
  ).at(-1);

  if (lastSlide) {
    return {
      x: lastSlide.x + lastSlide.width + NEW_FRAME_GAP,
      y: lastSlide.y,
    };
  }

  return {
    x: -appState.scrollX + appState.width / 2 / appState.zoom.value - width / 2,
    y:
      -appState.scrollY +
      appState.height / 2 / appState.zoom.value -
      height / 2,
  };
};

/**
 * Resizes the selected frame to the given size, or — while the frame tool is
 * active — inserts a new frame of that size.
 */
export const actionChangeFrameSize = register<FrameSize>({
  name: "changeFrameSize",
  label: "frameSize.title",
  trackEvent: { category: "element" },
  perform: (elements, appState, size, app) => {
    if (!size) {
      return false;
    }

    const selectedFrame = getSingleSelectedFrame(appState, app);

    if (appState.activeTool.type !== "frame" && selectedFrame) {
      const frame = newElementWith(selectedFrame, size);
      const nextElements = elements.map((element) =>
        element.id === frame.id ? frame : element,
      );

      return {
        elements: replaceAllElementsInFrame(
          nextElements,
          getElementsInResizingFrame(
            nextElements,
            frame,
            appState,
            arrayToMap(nextElements),
          ),
          frame,
        ),
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      };
    }

    const frame = newFrameElement({
      ...getNewFramePosition(size, appState, app),
      ...size,
    });
    const { appState: viewport } = zoomToFitBounds({
      bounds: [frame.x, frame.y, frame.x + frame.width, frame.y + frame.height],
      appState,
      fit: "scale-down",
      canvasOffsets: app.viewport.getOffsets(),
    });

    return {
      elements: syncMovedIndices([...elements, frame], arrayToMap([frame])),
      appState: {
        ...appState,
        scrollX: viewport.scrollX,
        scrollY: viewport.scrollY,
        zoom: viewport.zoom,
        selectedElementIds: { [frame.id]: true },
        activeTool: updateActiveTool(appState, { type: "selection" }),
      },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  predicate: (elements, appState, _, app) =>
    appState.activeTool.type === "frame" ||
    !!getSingleSelectedFrame(appState, app),
  PanelComponent: ({ updateData, app }) => (
    <FrameSizePanel app={app} onChange={updateData} />
  ),
});

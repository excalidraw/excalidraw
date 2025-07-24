import { updateActiveTool } from "@excalidraw/common";

import { CaptureUpdateAction } from "@excalidraw/element";

import { setCursorForShape } from "../cursor";

import { register } from "./register";

/**
 * Action to activate the raster pencil tool
 * Raster pencil draws directly onto a bitmap canvas layer for improved performance
 * compared to creating vector elements, especially beneficial on tablets/less powerful hardware
 */
export const actionSetRasterPencilAsActiveTool = register({
  name: "setRasterPencilAsActiveTool",
  trackEvent: { category: "toolbar" },
  target: "Tool",
  label: "toolBar.rasterPencil",
  perform: (elements, appState, _, app) => {
    const nextActiveTool = updateActiveTool(appState, {
      type: "rasterpencil",
    });

    setCursorForShape(app.canvas, {
      ...appState,
      activeTool: nextActiveTool,
    });

    return {
      elements,
      appState: {
        ...appState,
        activeTool: updateActiveTool(appState, {
          type: "rasterpencil",
        }),
      },
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
});

/**
 * Action to activate the raster eraser tool
 * Erases bitmap content using canvas composite operations (destination-out)
 */
export const actionSetRasterEraserAsActiveTool = register({
  name: "setRasterEraserAsActiveTool",
  trackEvent: { category: "toolbar" },
  target: "Tool", 
  label: "toolBar.rasterEraser",
  perform: (elements, appState, _, app) => {
    const nextActiveTool = updateActiveTool(appState, {
      type: "rastereraser",
    });

    setCursorForShape(app.canvas, {
      ...appState,
      activeTool: nextActiveTool,
    });

    return {
      elements,
      appState: {
        ...appState,
        activeTool: updateActiveTool(appState, {
          type: "rastereraser",
        }),
      },
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
});

/**
 * Action to activate the raster lasso tool
 * For selecting and moving raster content (currently placeholder implementation)
 * Future implementation will allow selection and manipulation of bitmap regions
 */
export const actionSetRasterLassoAsActiveTool = register({
  name: "setRasterLassoAsActiveTool",
  trackEvent: { category: "toolbar" },
  target: "Tool",
  label: "toolBar.rasterLasso",
  perform: (elements, appState, _, app) => {
    const nextActiveTool = updateActiveTool(appState, {
      type: "rasterlasso",
    });

    setCursorForShape(app.canvas, {
      ...appState,
      activeTool: nextActiveTool,
    });

    return {
      elements,
      appState: {
        ...appState,
        activeTool: updateActiveTool(appState, {
          type: "rasterlasso", 
        }),
      },
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
});

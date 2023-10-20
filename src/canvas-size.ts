import { newElement } from "./element";
import { newElementWith } from "./element/mutateElement";
import { getNormalizedZoom } from "./scene";
import { AppProps, AppState, CanvasSize } from "./types";

export function adjustAppStateForCanvasSize(
  state: AppState,
  isSizeChanged: boolean,
  defaultCanvasSize?: AppProps["defaultCanvasSize"],
): AppState {
  if (state.canvasSize.mode === "infinite") {
    return state;
  }
  const { viewBackgroundColor } = state;
  const canvasSize: CanvasSize =
    state.canvasSize.mode !== "default"
      ? state.canvasSize
      : defaultCanvasSize
      ? { mode: "fixed", ...defaultCanvasSize }
      : { mode: "infinite" };

  if (canvasSize.mode !== "fixed") {
    return { ...state, canvasSize };
  }

  const scroll = updateCanvasSize(state, canvasSize, isSizeChanged);

  return {
    ...state,
    canvasSize,
    ...scroll,
    fixedCanvasFrameElement: state.fixedCanvasFrameElement
      ? newElementWith(state.fixedCanvasFrameElement, {
          width: canvasSize.width,
          height: canvasSize.height,
          backgroundColor: viewBackgroundColor,
        })
      : newElement({
          type: "rectangle",
          x: 0,
          y: 0,
          strokeColor: "#00000005",
          backgroundColor: viewBackgroundColor,
          fillStyle: "solid",
          strokeWidth: 1,
          strokeStyle: "solid",
          roughness: 0,
          opacity: 100,
          // strokeSharpness: "sharp",
          locked: true,
          width: canvasSize.width,
          height: canvasSize.height,
        }),
  };
}

function updateCanvasSize(
  state: AppState,
  canvasSize: CanvasSize,
  isSizeChanged: boolean,
) {
  if (canvasSize.mode !== "fixed" || !isSizeChanged) {
    return {};
  }

  const { width: viewportWidth, height: viewportHeight } = state;
  let { width: canvasWidth, height: canvasHeight } = canvasSize;
  let scale = 0;
  if (viewportWidth > canvasWidth) {
    scale = Math.max(
      viewportWidth / canvasWidth,
      viewportHeight / canvasHeight,
    );
  } else {
    scale = Math.min(
      viewportWidth / canvasWidth,
      viewportHeight / canvasHeight,
    );
  }

  [canvasWidth, canvasHeight] = [canvasWidth, canvasHeight].map(
    (v) => v * scale,
  );

  return {
    scrollX:
      viewportWidth > canvasWidth
        ? (viewportWidth - canvasWidth) / 2 / scale
        : 0,
    scrollY:
      viewportHeight > canvasHeight
        ? (viewportHeight - canvasHeight) / 2 / scale
        : 0,
    zoom: {
      value: getNormalizedZoom(scale),
    },
  };
}

// function round(num: number, decimalPlaces = 0) {
//   const p = Math.pow(10, decimalPlaces);
//   return Math.round(num * p) / p;
// }

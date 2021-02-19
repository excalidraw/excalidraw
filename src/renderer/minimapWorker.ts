/* eslint-disable no-restricted-globals */

import { getNonDeletedElements } from "../element";
import { ExcalidrawElement } from "../element/types";
import { exportToCanvas } from "../scene/export";
import { AppState } from "../types";

const ctx: Worker = self as any;
let canvas: OffscreenCanvas;

ctx.addEventListener("message", (ev) => {
  if (ev.data.type === "INIT") {
    canvas = ev.data.canvas;
  }

  if (ev.data.type === "DRAW") {
    const { elements, appState, width, height } = ev.data;
    drawScene(canvas, elements, appState, width, height);
  }
});

function drawScene(
  canvas: OffscreenCanvas,
  elements: readonly ExcalidrawElement[],
  appState: AppState,
  minimapWidth: number,
  minimapHeight: number,
) {
  exportToCanvas(
    getNonDeletedElements(elements),
    appState,
    {
      exportBackground: true,
      viewBackgroundColor: appState.viewBackgroundColor,
      shouldAddWatermark: false,
    },
    (width, height) => {
      const scale = Math.min(minimapWidth / width, minimapHeight / height);
      canvas.width = width * scale;
      canvas.height = height * scale;

      return {
        canvas,
        scale,
      };
    },
  );
}

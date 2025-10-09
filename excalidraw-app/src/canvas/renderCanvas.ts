import { CanvasState, ExcalidrawElement } from "./types";

export function renderCanvas(ctx: CanvasRenderingContext2D, canvasState: CanvasState) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  canvasState.layers.forEach((layer) => {
    if (!layer.visible) return;

    layer.elements.forEach((element) => renderElement(ctx, element));
  });
}

function renderElement(ctx: CanvasRenderingContext2D, element: ExcalidrawElement) {
  ctx.fillStyle = "black";
  ctx.fillRect(element.x, element.y, element.width, element.height);
}

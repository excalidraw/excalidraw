export function getZoomOrigin(canvas: HTMLCanvasElement | null) {
  if (canvas === null) {
    return { x: 0, y: 0 };
  }
  const context = canvas.getContext("2d");
  if (context === null) {
    return { x: 0, y: 0 };
  }

  const normalizedCanvasWidth = canvas.width / context.getTransform().a;
  const normalizedCanvasHeight = canvas.height / context.getTransform().d;

  return {
    x: normalizedCanvasWidth / 2,
    y: normalizedCanvasHeight / 2,
  };
}

export function getZoomTranslation(canvas: HTMLCanvasElement, zoom: number) {
  const diffMiddleOfTheCanvas = {
    x: (canvas.width / 2) * (zoom - 1),
    y: (canvas.height / 2) * (zoom - 1),
  };

  // Due to JavaScript float precision, we fix to fix decimals count to have symmetric zoom
  return {
    x: parseFloat(diffMiddleOfTheCanvas.x.toFixed(8)),
    y: parseFloat(diffMiddleOfTheCanvas.y.toFixed(8)),
  };
}

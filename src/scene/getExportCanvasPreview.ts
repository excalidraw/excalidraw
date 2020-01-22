import rough from "roughjs/bin/rough";
import { ExcalidrawElement } from "../element/types";
import { getElementAbsoluteCoords } from "../element/bounds";
import { renderScene } from "../renderer/renderScene";

export function getExportCanvasPreview(
  elements: readonly ExcalidrawElement[],
  {
    exportBackground,
    exportPadding = 10,
    viewBackgroundColor,
    scale = 1
  }: {
    exportBackground: boolean;
    exportPadding?: number;
    scale?: number;
    viewBackgroundColor: string;
  },
  createCanvas: (width: number, height: number) => any = function(
    width,
    height
  ) {
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = width * scale;
    tempCanvas.height = height * scale;
    return tempCanvas;
  }
) {
  // calculate smallest area to fit the contents in
  let subCanvasX1 = Infinity;
  let subCanvasX2 = 0;
  let subCanvasY1 = Infinity;
  let subCanvasY2 = 0;

  elements.forEach(element => {
    const [x1, y1, x2, y2] = getElementAbsoluteCoords(element);
    subCanvasX1 = Math.min(subCanvasX1, x1);
    subCanvasY1 = Math.min(subCanvasY1, y1);
    subCanvasX2 = Math.max(subCanvasX2, x2);
    subCanvasY2 = Math.max(subCanvasY2, y2);
  });

  function distance(x: number, y: number) {
    return Math.abs(x > y ? x - y : y - x);
  }

  const width = distance(subCanvasX1, subCanvasX2) + exportPadding * 2;
  const height = distance(subCanvasY1, subCanvasY2) + exportPadding * 2;
  const tempCanvas: any = createCanvas(width, height);
  tempCanvas.getContext("2d")?.scale(scale, scale);

  renderScene(
    elements,
    rough.canvas(tempCanvas),
    tempCanvas,
    {
      viewBackgroundColor: exportBackground ? viewBackgroundColor : null,
      scrollX: 0,
      scrollY: 0
    },
    {
      offsetX: -subCanvasX1 + exportPadding,
      offsetY: -subCanvasY1 + exportPadding,
      renderScrollbars: false,
      renderSelection: false
    }
  );
  return tempCanvas;
}

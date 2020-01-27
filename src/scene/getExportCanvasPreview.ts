import rough from "roughjs/bin/rough";
import { ExcalidrawElement } from "../element/types";
import { getCommonBounds } from "../element/bounds";
import { renderScene, renderSceneToSvg } from "../renderer/renderScene";
import { distance } from "../utils";

export function getExportCanvasPreview(
  elements: readonly ExcalidrawElement[],
  {
    exportBackground,
    exportPadding = 10,
    viewBackgroundColor,
    scale = 1,
  }: {
    exportBackground: boolean;
    exportPadding?: number;
    scale?: number;
    viewBackgroundColor: string;
  },
  createCanvas: (width: number, height: number) => any = function(
    width,
    height,
  ) {
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = width * scale;
    tempCanvas.height = height * scale;
    return tempCanvas;
  },
) {
  // calculate smallest area to fit the contents in
  const [minX, minY, maxX, maxY] = getCommonBounds(elements);
  const width = distance(minX, maxX) + exportPadding * 2;
  const height = distance(minY, maxY) + exportPadding * 2;

  const tempCanvas: any = createCanvas(width, height);
  tempCanvas.getContext("2d")?.scale(scale, scale);

  renderScene(
    elements,
    rough.canvas(tempCanvas),
    tempCanvas,
    {
      viewBackgroundColor: exportBackground ? viewBackgroundColor : null,
      scrollX: 0,
      scrollY: 0,
    },
    {
      offsetX: -minX + exportPadding,
      offsetY: -minY + exportPadding,
      renderScrollbars: false,
      renderSelection: false,
    },
  );
  return tempCanvas;
}

export function getExportSvgPreview(
  elements: readonly ExcalidrawElement[],
): SVGSVGElement {
  const svgRoot = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svgRoot.setAttribute("version", "1.1");
  svgRoot.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  const rsvg = rough.svg(svgRoot);
  renderSceneToSvg(elements, rsvg, svgRoot);
  return svgRoot;
}

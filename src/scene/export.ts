import rough from "roughjs/bin/rough";
import { ExcalidrawElement } from "../element/types";
import { getCommonBounds } from "../element/bounds";
import { renderScene, renderSceneToSvg } from "../renderer/renderScene";
import { distance, SVG_NS } from "../utils";
import { normalizeScroll } from "./scroll";
import { AppState } from "../types";

export function exportToCanvas(
  elements: readonly ExcalidrawElement[],
  appState: AppState,
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
  createCanvas: (width: number, height: number) => any = function (
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

  renderScene(
    elements,
    appState,
    null,
    scale,
    rough.canvas(tempCanvas),
    tempCanvas,
    {
      viewBackgroundColor: exportBackground ? viewBackgroundColor : null,
      scrollX: normalizeScroll(-minX + exportPadding),
      scrollY: normalizeScroll(-minY + exportPadding),
      zoom: 1,
      remotePointerViewportCoords: {},
      remoteSelectedElementIds: {},
      shouldCacheIgnoreZoom: false,
    },
    {
      renderScrollbars: false,
      renderSelection: false,
      renderOptimizations: false,
    },
  );
  return tempCanvas;
}

export function exportToSvg(
  elements: readonly ExcalidrawElement[],
  {
    exportBackground,
    exportPadding = 10,
    viewBackgroundColor,
  }: {
    exportBackground: boolean;
    exportPadding?: number;
    viewBackgroundColor: string;
  },
): SVGSVGElement {
  // calculate canvas dimensions
  const [minX, minY, maxX, maxY] = getCommonBounds(elements);
  const width = distance(minX, maxX) + exportPadding * 2;
  const height = distance(minY, maxY) + exportPadding * 2;

  // initialze SVG root
  const svgRoot = document.createElementNS(SVG_NS, "svg");
  svgRoot.setAttribute("version", "1.1");
  svgRoot.setAttribute("xmlns", SVG_NS);
  svgRoot.setAttribute("viewBox", `0 0 ${width} ${height}`);

  svgRoot.innerHTML = `
  <defs>
    <style>
      @font-face {
        font-family: "Virgil";
        src: url("https://excalidraw.com/FG_Virgil.ttf");
      }
      @font-face {
        font-family: "Cascadia";
        src: url("https://excalidraw.com/Cascadia.ttf");
      }
    </style>
  </defs>
  `;

  // render backgroiund rect
  if (exportBackground && viewBackgroundColor) {
    const rect = svgRoot.ownerDocument!.createElementNS(SVG_NS, "rect");
    rect.setAttribute("x", "0");
    rect.setAttribute("y", "0");
    rect.setAttribute("width", `${width}`);
    rect.setAttribute("height", `${height}`);
    rect.setAttribute("fill", viewBackgroundColor);
    svgRoot.appendChild(rect);
  }

  const rsvg = rough.svg(svgRoot);
  renderSceneToSvg(elements, rsvg, svgRoot, {
    offsetX: -minX + exportPadding,
    offsetY: -minY + exportPadding,
  });
  return svgRoot;
}

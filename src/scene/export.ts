import rough from "roughjs/bin/rough";
import oc from "open-color";
import { newTextElement } from "../element";
import { NonDeletedExcalidrawElement } from "../element/types";
import { getCommonBounds } from "../element/bounds";
import { renderScene, renderSceneToSvg } from "../renderer/renderScene";
import { distance, SVG_NS } from "../utils";
import { AppState } from "../types";
import { t } from "../i18n";
import { DEFAULT_FONT_FAMILY, DEFAULT_VERTICAL_ALIGN } from "../constants";
import { getDefaultAppState } from "../appState";

export const SVG_EXPORT_TAG = `<!-- svg-source:excalidraw -->`;
const WATERMARK_HEIGHT = 16;

export const exportToCanvas = (
  elements: readonly NonDeletedExcalidrawElement[],
  appState: AppState,
  {
    exportBackground,
    exportPadding = 10,
    viewBackgroundColor,
    scale = 1,
    shouldAddWatermark,
  }: {
    exportBackground: boolean;
    exportPadding?: number;
    scale?: number;
    viewBackgroundColor: string;
    shouldAddWatermark: boolean;
  },
  createCanvas: (
    width: number,
    height: number,
  ) => { canvas: HTMLCanvasElement; scale: number } = (width, height) => {
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = width * scale;
    tempCanvas.height = height * scale;
    return { canvas: tempCanvas, scale };
  },
) => {
  const sceneElements = getElementsAndWatermark(elements, shouldAddWatermark);

  const [minX, minY, width, height] = getCanvasSize(
    sceneElements,
    exportPadding,
    shouldAddWatermark,
  );

  const { canvas: tempCanvas, scale: newScale = scale } = createCanvas(
    width,
    height,
  );

  renderScene(
    sceneElements,
    appState,
    null,
    newScale,
    rough.canvas(tempCanvas),
    tempCanvas,
    {
      viewBackgroundColor: exportBackground ? viewBackgroundColor : null,
      scrollX: -minX + exportPadding,
      scrollY: -minY + exportPadding,
      zoom: getDefaultAppState().zoom,
      remotePointerViewportCoords: {},
      remoteSelectedElementIds: {},
      shouldCacheIgnoreZoom: false,
      remotePointerUsernames: {},
      remotePointerUserStates: {},
    },
    {
      renderScrollbars: false,
      renderSelection: false,
      renderOptimizations: false,
      renderGrid: false,
    },
  );

  return tempCanvas;
};

export const exportToSvg = (
  elements: readonly NonDeletedExcalidrawElement[],
  {
    exportBackground,
    exportPadding = 10,
    viewBackgroundColor,
    scale = 1,
    shouldAddWatermark,
    metadata = "",
  }: {
    exportBackground: boolean;
    exportPadding?: number;
    scale?: number;
    viewBackgroundColor: string;
    shouldAddWatermark: boolean;
    metadata?: string;
  },
): SVGSVGElement => {
  const sceneElements = getElementsAndWatermark(elements, shouldAddWatermark);

  const [minX, minY, width, height] = getCanvasSize(
    sceneElements,
    exportPadding,
    shouldAddWatermark,
  );

  // initialze SVG root
  const svgRoot = document.createElementNS(SVG_NS, "svg");
  svgRoot.setAttribute("version", "1.1");
  svgRoot.setAttribute("xmlns", SVG_NS);
  svgRoot.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svgRoot.setAttribute("width", `${width * scale}`);
  svgRoot.setAttribute("height", `${height * scale}`);

  svgRoot.innerHTML = `
  ${SVG_EXPORT_TAG}
  ${metadata}
  <defs>
    <style>
      @font-face {
        font-family: "Virgil";
        src: url("https://excalidraw.com/FG_Virgil.woff2");
      }
      @font-face {
        font-family: "Cascadia";
        src: url("https://excalidraw.com/Cascadia.woff2");
      }
    </style>
  </defs>
  `;

  // render background rect
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
  renderSceneToSvg(sceneElements, rsvg, svgRoot, {
    offsetX: -minX + exportPadding,
    offsetY: -minY + exportPadding,
  });

  return svgRoot;
};

const getElementsAndWatermark = (
  elements: readonly NonDeletedExcalidrawElement[],
  shouldAddWatermark: boolean,
): readonly NonDeletedExcalidrawElement[] => {
  let _elements = [...elements];

  if (shouldAddWatermark) {
    const [, , maxX, maxY] = getCommonBounds(elements);
    _elements = [..._elements, getWatermarkElement(maxX, maxY)];
  }

  return _elements;
};

const getWatermarkElement = (maxX: number, maxY: number) => {
  return newTextElement({
    text: t("labels.madeWithExcalidraw"),
    fontSize: WATERMARK_HEIGHT,
    fontFamily: DEFAULT_FONT_FAMILY,
    textAlign: "right",
    verticalAlign: DEFAULT_VERTICAL_ALIGN,
    x: maxX,
    y: maxY + WATERMARK_HEIGHT,
    strokeColor: oc.gray[5],
    backgroundColor: "transparent",
    fillStyle: "hachure",
    strokeWidth: 1,
    strokeStyle: "solid",
    roughness: 1,
    opacity: 100,
    strokeSharpness: "sharp",
  });
};

// calculate smallest area to fit the contents in
const getCanvasSize = (
  elements: readonly NonDeletedExcalidrawElement[],
  exportPadding: number,
  shouldAddWatermark: boolean,
): [number, number, number, number] => {
  const [minX, minY, maxX, maxY] = getCommonBounds(elements);
  const width = distance(minX, maxX) + exportPadding * 2;
  const height =
    distance(minY, maxY) +
    exportPadding +
    (shouldAddWatermark ? 0 : exportPadding);

  return [minX, minY, width, height];
};

export const getExportSize = (
  elements: readonly NonDeletedExcalidrawElement[],
  exportPadding: number,
  shouldAddWatermark: boolean,
  scale: number,
): [number, number] => {
  const sceneElements = getElementsAndWatermark(elements, shouldAddWatermark);

  const [, , width, height] = getCanvasSize(
    sceneElements,
    exportPadding,
    shouldAddWatermark,
  ).map((dimension) => Math.trunc(dimension * scale));

  return [width, height];
};

import rough from "roughjs/bin/rough";
import { NonDeletedExcalidrawElement } from "../element/types";
import { getCommonBounds } from "../element/bounds";
import { renderScene, renderSceneToSvg } from "../renderer/renderScene";
import { distance } from "../utils";
import { AppState, BinaryFiles } from "../types";
import { DEFAULT_EXPORT_PADDING, SVG_NS, THEME_FILTER } from "../constants";
import { getDefaultAppState } from "../appState";
import { serializeAsJSON } from "../data/json";
import {
  getInitializedImageElements,
  updateImageCache,
} from "../element/image";

export const SVG_EXPORT_TAG = `<!-- svg-source:excalidraw -->`;

const getExactBoundingBox = async (
  elements: readonly NonDeletedExcalidrawElement[],
  appState: {
    exportBackground: boolean;
    exportPadding?: number;
    exportScale?: number;
    viewBackgroundColor: string;
    exportWithDarkMode?: boolean;
    exportEmbedScene?: boolean;
  },
  files: BinaryFiles,
): Promise<
  [offsetLeft: number, offsetTop: number, width: number, height: number]
> => {
  const padding = DEFAULT_EXPORT_PADDING;
  // const padding = 0;
  const [minX, minY, width, height] = getApproximateCanvasSize(
    elements,
    padding,
  );

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const { imageCache } = await updateImageCache({
    imageCache: new Map(),
    fileIds: getInitializedImageElements(elements).map(
      (element) => element.fileId,
    ),
    files,
  });

  const defaultAppState = getDefaultAppState();

  renderScene({
    elements,
    // @ts-ignore
    appState,
    scale: 1,
    rc: rough.canvas(canvas),
    canvas,
    renderConfig: {
      viewBackgroundColor: null,
      scrollX: -minX + padding,
      scrollY: -minY + padding,
      zoom: defaultAppState.zoom,
      remotePointerViewportCoords: {},
      remoteSelectedElementIds: {},
      shouldCacheIgnoreZoom: false,
      remotePointerUsernames: {},
      remotePointerUserStates: {},
      theme: "light",
      imageCache,
      renderScrollbars: false,
      renderSelection: false,
      renderGrid: false,
      isExporting: true,
    },
  });

  const ctx = canvas.getContext("2d")!;
  const { data } = ctx.getImageData(0, 0, width, height);

  let _minX = Infinity;
  let _minY = Infinity;
  let _maxX = -Infinity;
  let _maxY = -Infinity;

  const rows = [];
  let row: number[][] = [];
  for (let i = 0; i < data.length - 1; i = i + 4) {
    if (i && i % (width * 4) === 0) {
      rows.push(row);
      row = [];
    }
    const pixel = [data[i], data[i + 1], data[i + 2], data[i + 3]];
    row.push(pixel);
  }

  for (const [y, row] of rows.entries()) {
    for (const [x, pixel] of row.entries()) {
      if (pixel[3] > 0) {
        _minX = Math.min(_minX, x);
        _minY = Math.min(_minY, y);
        _maxX = Math.max(_maxX, x);
        _maxY = Math.max(_maxY, y);
      }
    }
  }

  const offsetLeft = padding - _minX;
  const offsetTop = padding - _minY;

  return [offsetLeft, offsetTop, _maxX - _minX, _maxY - _minY];
};
export const exportToCanvas = async (
  elements: readonly NonDeletedExcalidrawElement[],
  appState: AppState,
  files: BinaryFiles,
  {
    exportBackground,
    exportPadding = DEFAULT_EXPORT_PADDING,
    viewBackgroundColor,
  }: {
    exportBackground: boolean;
    exportPadding?: number;
    viewBackgroundColor: string;
  },
  createCanvas: (
    width: number,
    height: number,
  ) => { canvas: HTMLCanvasElement; scale: number } = (width, height) => {
    const canvas = document.createElement("canvas");
    canvas.width = width * appState.exportScale;
    canvas.height = height * appState.exportScale;
    return { canvas, scale: appState.exportScale };
  },
) => {
  const [scrollX, scrollY, width, height] = await getCanvasSize(
    elements,
    appState,
    files,
    exportPadding,
  );

  const { canvas, scale = 1 } = createCanvas(width, height);

  const defaultAppState = getDefaultAppState();

  const { imageCache } = await updateImageCache({
    imageCache: new Map(),
    fileIds: getInitializedImageElements(elements).map(
      (element) => element.fileId,
    ),
    files,
  });

  renderScene({
    elements,
    appState,
    scale,
    rc: rough.canvas(canvas),
    canvas,
    renderConfig: {
      viewBackgroundColor: exportBackground ? viewBackgroundColor : null,
      scrollX,
      scrollY,
      zoom: defaultAppState.zoom,
      remotePointerViewportCoords: {},
      remoteSelectedElementIds: {},
      shouldCacheIgnoreZoom: false,
      remotePointerUsernames: {},
      remotePointerUserStates: {},
      theme: appState.exportWithDarkMode ? "dark" : "light",
      imageCache,
      renderScrollbars: false,
      renderSelection: false,
      renderGrid: false,
      isExporting: true,
    },
  });

  return canvas;
};

export const exportToSvg = async (
  elements: readonly NonDeletedExcalidrawElement[],
  appState: {
    exportBackground: boolean;
    exportPadding?: number;
    exportScale?: number;
    viewBackgroundColor: string;
    exportWithDarkMode?: boolean;
    exportEmbedScene?: boolean;
  },
  files: BinaryFiles | null,
): Promise<SVGSVGElement> => {
  const {
    exportPadding = DEFAULT_EXPORT_PADDING,
    viewBackgroundColor,
    exportScale = 1,
    exportEmbedScene,
  } = appState;
  let metadata = "";
  if (exportEmbedScene) {
    try {
      metadata = await (
        await import(/* webpackChunkName: "image" */ "../../src/data/image")
      ).encodeSvgMetadata({
        text: serializeAsJSON(elements, appState, files || {}, "local"),
      });
    } catch (error: any) {
      console.error(error);
    }
  }
  const [minX, minY, width, height] = await getCanvasSize(
    elements,
    appState,
    files || {},
    exportPadding,
  );

  // initialize SVG root
  const svgRoot = document.createElementNS(SVG_NS, "svg");
  svgRoot.setAttribute("version", "1.1");
  svgRoot.setAttribute("xmlns", SVG_NS);
  svgRoot.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svgRoot.setAttribute("width", `${width * exportScale}`);
  svgRoot.setAttribute("height", `${height * exportScale}`);
  if (appState.exportWithDarkMode) {
    svgRoot.setAttribute("filter", THEME_FILTER);
  }

  let assetPath = "https://excalidraw.com/";

  // Asset path needs to be determined only when using package
  if (process.env.IS_EXCALIDRAW_NPM_PACKAGE) {
    assetPath =
      window.EXCALIDRAW_ASSET_PATH ||
      `https://unpkg.com/${process.env.PKG_NAME}@${process.env.PKG_VERSION}`;

    if (assetPath?.startsWith("/")) {
      assetPath = assetPath.replace("/", `${window.location.origin}/`);
    }
    assetPath = `${assetPath}/dist/excalidraw-assets/`;
  }
  svgRoot.innerHTML = `
  ${SVG_EXPORT_TAG}
  ${metadata}
  <defs>
    <style>
      @font-face {
        font-family: "Virgil";
        src: url("${assetPath}Virgil.woff2");
      }
      @font-face {
        font-family: "Cascadia";
        src: url("${assetPath}Cascadia.woff2");
      }
    </style>
  </defs>
  `;
  // render background rect
  if (appState.exportBackground && viewBackgroundColor) {
    const rect = svgRoot.ownerDocument!.createElementNS(SVG_NS, "rect");
    rect.setAttribute("x", "0");
    rect.setAttribute("y", "0");
    rect.setAttribute("width", `${width}`);
    rect.setAttribute("height", `${height}`);
    rect.setAttribute("fill", viewBackgroundColor);
    svgRoot.appendChild(rect);
  }

  const rsvg = rough.svg(svgRoot);
  renderSceneToSvg(elements, rsvg, svgRoot, files || {}, {
    offsetX: -minX + exportPadding,
    offsetY: -minY + exportPadding,
    exportWithDarkMode: appState.exportWithDarkMode,
  });

  return svgRoot;
};

const getApproximateCanvasSize = (
  elements: readonly NonDeletedExcalidrawElement[],
  exportPadding: number,
): [number, number, number, number] => {
  const bounds = getCommonBounds(elements);

  const minX = Math.floor(bounds[0]);
  const minY = Math.floor(bounds[1]);
  const maxX = Math.ceil(bounds[2]);
  const maxY = Math.ceil(bounds[3]);

  const width = distance(minX, maxX) + exportPadding * 2;
  const height =
    Math.ceil(distance(minY, maxY)) + exportPadding + exportPadding;

  return [minX, minY, width, height];
};

// calculate smallest area to fit the contents in
const getCanvasSize = async (
  elements: readonly NonDeletedExcalidrawElement[],
  appState: {
    exportBackground: boolean;
    exportPadding?: number;
    exportScale?: number;
    viewBackgroundColor: string;
    exportWithDarkMode?: boolean;
    exportEmbedScene?: boolean;
  },
  files: BinaryFiles,
  exportPadding: number,
): Promise<[number, number, number, number]> => {
  if (exportPadding) {
    const [minX, minY, width, height] = getApproximateCanvasSize(
      elements,
      exportPadding,
    );

    return [-minX + exportPadding, -minY + exportPadding, width, height];
  } else {
    const [minX, minY] = getApproximateCanvasSize(elements, exportPadding);

    const [offsetLeft, offsetRight, width, height] = await getExactBoundingBox(
      elements,
      appState,
      files,
    );
    return [-minX + offsetLeft, -minY + offsetRight, width, height];
  }
};

export const getExportSize = (
  elements: readonly NonDeletedExcalidrawElement[],
  exportPadding: number,
  scale: number,
): [number, number] => {
  const [, , width, height] = getApproximateCanvasSize(
    elements,
    exportPadding,
  ).map((dimension) => Math.trunc(dimension * scale));

  return [width, height];
};

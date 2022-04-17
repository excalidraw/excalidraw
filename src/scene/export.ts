import rough from "roughjs/bin/rough";
import { NonDeletedExcalidrawElement, Theme } from "../element/types";
import { getCommonBounds } from "../element/bounds";
import { renderScene, renderSceneToSvg } from "../renderer/renderScene";
import { bytesToHexString, distance } from "../utils";
import { AppState, BinaryFiles } from "../types";
import {
  DEFAULT_EXPORT_PADDING,
  SVG_NS,
  THEME,
  THEME_FILTER,
} from "../constants";
import { getDefaultAppState } from "../appState";
import { serializeAsJSON } from "../data/json";
import {
  getInitializedImageElements,
  updateImageCache,
} from "../element/image";
import { nanoid } from "nanoid";

export const SVG_EXPORT_TAG = `<!-- svg-source:excalidraw -->`;

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
  const [minX, minY, width, height] = getCanvasSize(elements, exportPadding);

  const { canvas, scale = 1 } = createCanvas(width, height);

  const defaultAppState = getDefaultAppState();

  let theme = appState.exportTheme;
  if (theme === THEME.SYSTEM) {
    theme = matchMedia("(prefers-color-scheme: dark)").matches
      ? THEME.DARK
      : THEME.LIGHT;
  }

  const { imageCache } = await updateImageCache({
    imageCache: new Map(),
    fileIds: getInitializedImageElements(elements).map(
      (element) => element.fileId,
    ),
    files,
  });

  renderScene(elements, appState, null, scale, rough.canvas(canvas), canvas, {
    viewBackgroundColor: exportBackground ? viewBackgroundColor : null,
    scrollX: -minX + exportPadding,
    scrollY: -minY + exportPadding,
    zoom: defaultAppState.zoom,
    remotePointerViewportCoords: {},
    remoteSelectedElementIds: {},
    shouldCacheIgnoreZoom: false,
    remotePointerUsernames: {},
    remotePointerUserStates: {},
    theme,
    imageCache,
    renderScrollbars: false,
    renderSelection: false,
    renderGrid: false,
    isExporting: true,
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
    exportTheme?: Theme;
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
  const [minX, minY, width, height] = getCanvasSize(elements, exportPadding);

  // initialize SVG root
  const svgRoot = document.createElementNS(SVG_NS, "svg");
  svgRoot.setAttribute("version", "1.1");
  svgRoot.setAttribute("xmlns", SVG_NS);
  svgRoot.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svgRoot.setAttribute("width", `${width * exportScale}`);
  svgRoot.setAttribute("height", `${height * exportScale}`);

  svgRoot.innerHTML = `
  ${SVG_EXPORT_TAG}
  ${metadata}
  <defs>
    <style>
      @font-face {
        font-family: "Virgil";
        src: url("https://excalidraw.com/Virgil.woff2");
      }
      @font-face {
        font-family: "Cascadia";
        src: url("https://excalidraw.com/Cascadia.woff2");
      }
    </style>
  </defs>
  `;
  const style = svgRoot.querySelector("style") as HTMLStyleElement;

  // create a group to wrap the scene, allowing to easily apply a `filter` property to all elements
  const groupRoot = document.createElementNS(SVG_NS, "g");
  svgRoot.appendChild(groupRoot);

  let groupId = "";
  if (
    appState.exportTheme === THEME.DARK ||
    appState.exportTheme === THEME.SYSTEM
  ) {
    // use a uniquely generated ID for the group to avoid duplicates when inlining multiple SVGs in a webpage
    groupId = `group-${await generateIdFromElements(elements)}`;
    groupRoot.setAttribute("id", groupId);
  }

  // append CSS to apply dark or system theme
  if (appState.exportTheme === THEME.DARK) {
    const css = `
      #${groupId}, image {
        filter: ${THEME_FILTER};
      }
    `;
    addCssToStyle(css, style);
  } else if (appState.exportTheme === THEME.SYSTEM) {
    const css = `
      @media (prefers-color-scheme: dark) {
        #${groupId}, image {
          filter: ${THEME_FILTER};
        }
      }
    `;
    addCssToStyle(css, style);
  }

  // render background rect
  if (appState.exportBackground && viewBackgroundColor) {
    const rect = svgRoot.ownerDocument!.createElementNS(SVG_NS, "rect");
    rect.setAttribute("x", "0");
    rect.setAttribute("y", "0");
    rect.setAttribute("width", `${width}`);
    rect.setAttribute("height", `${height}`);
    rect.setAttribute("fill", viewBackgroundColor);
    groupRoot.appendChild(rect);
  }

  const rsvg = rough.svg(svgRoot);
  renderSceneToSvg(elements, rsvg, groupRoot, files || {}, {
    offsetX: -minX + exportPadding,
    offsetY: -minY + exportPadding,
  });

  return svgRoot;
};

// calculate smallest area to fit the contents in
const getCanvasSize = (
  elements: readonly NonDeletedExcalidrawElement[],
  exportPadding: number,
): [number, number, number, number] => {
  const [minX, minY, maxX, maxY] = getCommonBounds(elements);
  const width = distance(minX, maxX) + exportPadding * 2;
  const height = distance(minY, maxY) + exportPadding + exportPadding;

  return [minX, minY, width, height];
};

export const getExportSize = (
  elements: readonly NonDeletedExcalidrawElement[],
  exportPadding: number,
  scale: number,
): [number, number] => {
  const [, , width, height] = getCanvasSize(elements, exportPadding).map(
    (dimension) => Math.trunc(dimension * scale),
  );

  return [width, height];
};

/**
 * Generates SHA-1 digest from supplied string (if not supported, falls back to
 * a 40-char base64 random id)
 */
const generateIdFromElements = async (
  elements: readonly NonDeletedExcalidrawElement[],
): Promise<string> => {
  try {
    const str = JSON.stringify(elements);
    const blob = new Blob([str], { type: "text/plain; charset=utf-8" });
    const hashBuffer = await window.crypto.subtle.digest(
      "SHA-1",
      await blob.arrayBuffer(),
    );
    return bytesToHexString(new Uint8Array(hashBuffer));
  } catch (error: any) {
    console.error(error);
    // length 40 to align with the HEX length of SHA-1 (which is 160 bit)
    return nanoid(40);
  }
};

/**
 * Adds CSS to the style tag without breaking the indentation
 */
const addCssToStyle = (css: string, style: HTMLStyleElement) => {
  const content = style.innerHTML;
  const paddingIndex = content.trimEnd().length;
  const styleCss = content.trimEnd();
  const paddingEnd = content.slice(paddingIndex);
  style.innerHTML = styleCss + css.trimEnd() + paddingEnd;
};

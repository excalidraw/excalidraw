import rough from "roughjs/bin/rough";
import {
  ExcalidrawElement,
  ExcalidrawFrameLikeElement,
  ExcalidrawTextElement,
  NonDeletedExcalidrawElement,
} from "../element/types";
import {
  Bounds,
  getCommonBounds,
  getElementAbsoluteCoords,
} from "../element/bounds";
import { renderSceneToSvg, renderStaticScene } from "../renderer/renderScene";
import { cloneJSON, distance, getFontString } from "../utils";
import { AppState, BinaryFiles } from "../types";
import {
  DEFAULT_EXPORT_PADDING,
  FONT_FAMILY,
  FRAME_STYLE,
  SVG_NS,
  THEME_FILTER,
} from "../constants";
import { getDefaultAppState } from "../appState";
import { serializeAsJSON } from "../data/json";
import {
  getInitializedImageElements,
  updateImageCache,
} from "../element/image";
import { elementsOverlappingBBox } from "../packages/withinBounds";
import {
  getFrameLikeElements,
  getFrameLikeTitle,
  getRootElements,
} from "../frame";
import { newTextElement } from "../element";
import { Mutable } from "../utility-types";
import { newElementWith } from "../element/mutateElement";
import Scene from "./Scene";
import { isFrameElement, isFrameLikeElement } from "../element/typeChecks";

const SVG_EXPORT_TAG = `<!-- svg-source:excalidraw -->`;

// getContainerElement and getBoundTextElement and potentially other helpers
// depend on `Scene` which will not be available when these pure utils are
// called outside initialized Excalidraw editor instance or even if called
// from inside Excalidraw if the elements were never cached by Scene (e.g.
// for library elements).
//
// As such, before passing the elements down, we need to initialize a custom
// Scene instance and assign them to it.
//
// FIXME This is a super hacky workaround and we'll need to rewrite this soon.
const __createSceneForElementsHack__ = (
  elements: readonly ExcalidrawElement[],
) => {
  const scene = new Scene();
  // we can't duplicate elements to regenerate ids because we need the
  // orig ids when embedding. So we do another hack of not mapping element
  // ids to Scene instances so that we don't override the editor elements
  // mapping.
  // We still need to clone the objects themselves to regen references.
  scene.replaceAllElements(cloneJSON(elements), false);
  return scene;
};

const truncateText = (element: ExcalidrawTextElement, maxWidth: number) => {
  if (element.width <= maxWidth) {
    return element;
  }
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  ctx.font = getFontString({
    fontFamily: element.fontFamily,
    fontSize: element.fontSize,
  });

  let text = element.text;

  const metrics = ctx.measureText(text);

  if (metrics.width > maxWidth) {
    // we iterate from the right, removing characters one by one instead
    // of bulding the string up. This assumes that it's more likely
    // your frame names will overflow by not that many characters
    // (if ever), so it sohuld be faster this way.
    for (let i = text.length; i > 0; i--) {
      const newText = `${text.slice(0, i)}...`;
      if (ctx.measureText(newText).width <= maxWidth) {
        text = newText;
        break;
      }
    }
  }
  return newElementWith(element, { text, width: maxWidth });
};

/**
 * When exporting frames, we need to render frame labels which are currently
 * being rendered in DOM when editing. Adding the labels as regular text
 * elements seems like a simple hack. In the future we'll want to move to
 * proper canvas rendering, even within editor (instead of DOM).
 */
const addFrameLabelsAsTextElements = (
  elements: readonly NonDeletedExcalidrawElement[],
  opts: Pick<AppState, "exportWithDarkMode">,
) => {
  const nextElements: NonDeletedExcalidrawElement[] = [];
  let frameIndex = 0;
  let magicFrameIndex = 0;
  for (const element of elements) {
    if (isFrameLikeElement(element)) {
      if (isFrameElement(element)) {
        frameIndex++;
      } else {
        magicFrameIndex++;
      }
      let textElement: Mutable<ExcalidrawTextElement> = newTextElement({
        x: element.x,
        y: element.y - FRAME_STYLE.nameOffsetY,
        fontFamily: FONT_FAMILY.Assistant,
        fontSize: FRAME_STYLE.nameFontSize,
        lineHeight:
          FRAME_STYLE.nameLineHeight as ExcalidrawTextElement["lineHeight"],
        strokeColor: opts.exportWithDarkMode
          ? FRAME_STYLE.nameColorDarkTheme
          : FRAME_STYLE.nameColorLightTheme,
        text: getFrameLikeTitle(
          element,
          isFrameElement(element) ? frameIndex : magicFrameIndex,
        ),
      });
      textElement.y -= textElement.height;

      textElement = truncateText(textElement, element.width);

      nextElements.push(textElement);
    }
    nextElements.push(element);
  }

  return nextElements;
};

const getFrameRenderingConfig = (
  exportingFrame: ExcalidrawFrameLikeElement | null,
  frameRendering: AppState["frameRendering"] | null,
): AppState["frameRendering"] => {
  frameRendering = frameRendering || getDefaultAppState().frameRendering;
  return {
    enabled: exportingFrame ? true : frameRendering.enabled,
    outline: exportingFrame ? false : frameRendering.outline,
    name: exportingFrame ? false : frameRendering.name,
    clip: exportingFrame ? true : frameRendering.clip,
  };
};

const prepareElementsForRender = ({
  elements,
  exportingFrame,
  frameRendering,
  exportWithDarkMode,
}: {
  elements: readonly ExcalidrawElement[];
  exportingFrame: ExcalidrawFrameLikeElement | null | undefined;
  frameRendering: AppState["frameRendering"];
  exportWithDarkMode: AppState["exportWithDarkMode"];
}) => {
  let nextElements: readonly ExcalidrawElement[];

  if (exportingFrame) {
    nextElements = elementsOverlappingBBox({
      elements,
      bounds: exportingFrame,
      type: "overlap",
    });
  } else if (frameRendering.enabled && frameRendering.name) {
    nextElements = addFrameLabelsAsTextElements(elements, {
      exportWithDarkMode,
    });
  } else {
    nextElements = elements;
  }

  return nextElements;
};

export const exportToCanvas = async (
  elements: readonly NonDeletedExcalidrawElement[],
  appState: AppState,
  files: BinaryFiles,
  {
    exportBackground,
    exportPadding = DEFAULT_EXPORT_PADDING,
    viewBackgroundColor,
    exportingFrame,
  }: {
    exportBackground: boolean;
    exportPadding?: number;
    viewBackgroundColor: string;
    exportingFrame?: ExcalidrawFrameLikeElement | null;
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
  const tempScene = __createSceneForElementsHack__(elements);
  elements = tempScene.getNonDeletedElements();

  const frameRendering = getFrameRenderingConfig(
    exportingFrame ?? null,
    appState.frameRendering ?? null,
  );

  const elementsForRender = prepareElementsForRender({
    elements,
    exportingFrame,
    exportWithDarkMode: appState.exportWithDarkMode,
    frameRendering,
  });

  if (exportingFrame) {
    exportPadding = 0;
  }

  const [minX, minY, width, height] = getCanvasSize(
    exportingFrame ? [exportingFrame] : getRootElements(elementsForRender),
    exportPadding,
  );

  const { canvas, scale = 1 } = createCanvas(width, height);

  const defaultAppState = getDefaultAppState();

  const { imageCache } = await updateImageCache({
    imageCache: new Map(),
    fileIds: getInitializedImageElements(elementsForRender).map(
      (element) => element.fileId,
    ),
    files,
  });

  renderStaticScene({
    canvas,
    rc: rough.canvas(canvas),
    elements: elementsForRender,
    visibleElements: elementsForRender,
    scale,
    appState: {
      ...appState,
      frameRendering,
      viewBackgroundColor: exportBackground ? viewBackgroundColor : null,
      scrollX: -minX + exportPadding,
      scrollY: -minY + exportPadding,
      zoom: defaultAppState.zoom,
      shouldCacheIgnoreZoom: false,
      theme: appState.exportWithDarkMode ? "dark" : "light",
    },
    renderConfig: {
      canvasBackgroundColor: viewBackgroundColor,
      imageCache,
      renderGrid: false,
      isExporting: true,
    },
  });

  tempScene.destroy();

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
    frameRendering?: AppState["frameRendering"];
  },
  files: BinaryFiles | null,
  opts?: {
    renderEmbeddables?: boolean;
    exportingFrame?: ExcalidrawFrameLikeElement | null;
  },
): Promise<SVGSVGElement> => {
  const tempScene = __createSceneForElementsHack__(elements);
  elements = tempScene.getNonDeletedElements();

  const frameRendering = getFrameRenderingConfig(
    opts?.exportingFrame ?? null,
    appState.frameRendering ?? null,
  );

  let {
    exportPadding = DEFAULT_EXPORT_PADDING,
    exportWithDarkMode = false,
    viewBackgroundColor,
    exportScale = 1,
    exportEmbedScene,
  } = appState;

  const { exportingFrame = null } = opts || {};

  const elementsForRender = prepareElementsForRender({
    elements,
    exportingFrame,
    exportWithDarkMode,
    frameRendering,
  });

  if (exportingFrame) {
    exportPadding = 0;
  }

  let metadata = "";

  // we need to serialize the "original" elements before we put them through
  // the tempScene hack which duplicates and regenerates ids
  if (exportEmbedScene) {
    try {
      metadata = await (
        await import(/* webpackChunkName: "image" */ "../../src/data/image")
      ).encodeSvgMetadata({
        // when embedding scene, we want to embed the origionally supplied
        // elements which don't contain the temp frame labels.
        // But it also requires that the exportToSvg is being supplied with
        // only the elements that we're exporting, and no extra.
        text: serializeAsJSON(elements, appState, files || {}, "local"),
      });
    } catch (error: any) {
      console.error(error);
    }
  }

  const [minX, minY, width, height] = getCanvasSize(
    exportingFrame ? [exportingFrame] : getRootElements(elementsForRender),
    exportPadding,
  );

  // initialize SVG root
  const svgRoot = document.createElementNS(SVG_NS, "svg");
  svgRoot.setAttribute("version", "1.1");
  svgRoot.setAttribute("xmlns", SVG_NS);
  svgRoot.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svgRoot.setAttribute("width", `${width * exportScale}`);
  svgRoot.setAttribute("height", `${height * exportScale}`);
  if (exportWithDarkMode) {
    svgRoot.setAttribute("filter", THEME_FILTER);
  }

  let assetPath = "https://excalidraw.com/";
  // Asset path needs to be determined only when using package
  if (import.meta.env.VITE_IS_EXCALIDRAW_NPM_PACKAGE) {
    assetPath =
      window.EXCALIDRAW_ASSET_PATH ||
      `https://unpkg.com/${import.meta.env.VITE_PKG_NAME}@${
        import.meta.env.PKG_VERSION
      }`;

    if (assetPath?.startsWith("/")) {
      assetPath = assetPath.replace("/", `${window.location.origin}/`);
    }
    assetPath = `${assetPath}/dist/excalidraw-assets/`;
  }

  const offsetX = -minX + exportPadding;
  const offsetY = -minY + exportPadding;

  const frameElements = getFrameLikeElements(elements);

  let exportingFrameClipPath = "";
  for (const frame of frameElements) {
    const [x1, y1, x2, y2] = getElementAbsoluteCoords(frame);
    const cx = (x2 - x1) / 2 - (frame.x - x1);
    const cy = (y2 - y1) / 2 - (frame.y - y1);

    exportingFrameClipPath += `<clipPath id=${frame.id}>
            <rect transform="translate(${frame.x + offsetX} ${
      frame.y + offsetY
    }) rotate(${frame.angle} ${cx} ${cy})"
          width="${frame.width}"
          height="${frame.height}"
          >
          </rect>
        </clipPath>`;
  }

  svgRoot.innerHTML = `
  ${SVG_EXPORT_TAG}
  ${metadata}
  <defs>
    <style class="style-fonts">
      @font-face {
        font-family: "Virgil";
        src: url("${assetPath}Virgil.woff2");
      }
      @font-face {
        font-family: "Cascadia";
        src: url("${assetPath}Cascadia.woff2");
      }
      @font-face {
        font-family: "Assistant";
        src: url("${assetPath}Assistant-Regular.woff2");
      }
    </style>
    ${exportingFrameClipPath}
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
  renderSceneToSvg(elementsForRender, rsvg, svgRoot, files || {}, {
    offsetX,
    offsetY,
    isExporting: true,
    exportWithDarkMode,
    renderEmbeddables: opts?.renderEmbeddables ?? false,
    frameRendering,
    canvasBackgroundColor: viewBackgroundColor,
  });

  tempScene.destroy();

  return svgRoot;
};

// calculate smallest area to fit the contents in
const getCanvasSize = (
  elements: readonly NonDeletedExcalidrawElement[],
  exportPadding: number,
): Bounds => {
  const [minX, minY, maxX, maxY] = getCommonBounds(elements);
  const width = distance(minX, maxX) + exportPadding * 2;
  const height = distance(minY, maxY) + exportPadding * 2;

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

import rough from "roughjs/bin/rough";

import {
  FRAME_STYLE,
  FONT_FAMILY,
  SVG_NS,
  THEME,
  MIME_TYPES,
  EXPORT_DATA_TYPES,
  COLOR_WHITE,
  arrayToMap,
  distance,
  getFontString,
  toBrandedType,
  applyDarkModeFilter,
} from "@excalidraw/common";

import { getCommonBounds, getElementAbsoluteCoords } from "@excalidraw/element";

import {
  getInitializedImageElements,
  updateImageCache,
} from "@excalidraw/element";

import { newElementWith } from "@excalidraw/element";

import { isFrameLikeElement } from "@excalidraw/element";

import {
  getElementsOverlappingFrame,
  getFrameLikeElements,
  getFrameLikeTitle,
  getRootElements,
} from "@excalidraw/element";

import { syncInvalidIndices } from "@excalidraw/element";

import { type Mutable } from "@excalidraw/common/utility-types";

import { newTextElement } from "@excalidraw/element";

import type { Bounds } from "@excalidraw/common";

import type {
  ExcalidrawElement,
  ExcalidrawFrameLikeElement,
  ExcalidrawTextElement,
  NonDeletedExcalidrawElement,
  NonDeletedSceneElementsMap,
  Theme,
} from "@excalidraw/element/types";

import { getDefaultAppState } from "../appState";
import { base64ToString, decode, encode, stringToBase64 } from "../data/encode";
import { serializeAsJSON } from "../data/json";
import { restoreAppState } from "../data/restore";
import { encodePngMetadata } from "../data/image";

import { Fonts } from "../fonts";

import { renderStaticScene } from "../renderer/staticScene";
import { renderSceneToSvg } from "../renderer/staticSvgScene";

import {
  copyBlobToClipboardAsPng,
  copyTextToSystemClipboard,
  copyToClipboard,
} from "../clipboard";

import type { RenderableElementsMap } from "./types";

import type { AppState, BinaryFiles, NormalizedZoomValue } from "../types";

// Default minimum export size in pixels
const DEFAULT_SMALLEST_EXPORT_SIZE = 20;
const DEFAULT_ZOOM_VALUE = 1 as NormalizedZoomValue;

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
  for (const element of elements) {
    if (isFrameLikeElement(element)) {
      let textElement: Mutable<ExcalidrawTextElement> = newTextElement({
        x: element.x,
        y: element.y - FRAME_STYLE.nameOffsetY,
        fontFamily: FONT_FAMILY.Helvetica,
        fontSize: FRAME_STYLE.nameFontSize,
        lineHeight:
          FRAME_STYLE.nameLineHeight as ExcalidrawTextElement["lineHeight"],
        strokeColor: opts.exportWithDarkMode
          ? FRAME_STYLE.nameColorDarkTheme
          : FRAME_STYLE.nameColorLightTheme,
        text: getFrameLikeTitle(element),
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
    nextElements = getElementsOverlappingFrame(elements, exportingFrame);
  } else if (frameRendering.enabled && frameRendering.name) {
    nextElements = addFrameLabelsAsTextElements(elements, {
      exportWithDarkMode,
    });
  } else {
    nextElements = elements;
  }

  return nextElements;
};

// ---------------------------------------------------------------------------
// Types for the new API
// ---------------------------------------------------------------------------

export type ExportSceneData = {
  elements: readonly NonDeletedExcalidrawElement[];
  appState?: Partial<
    Omit<AppState, "offsetTop" | "offsetLeft" | "exportWithDarkMode">
  >;
  files: BinaryFiles | null;
};

export type ExportSceneConfig = {
  theme?: Theme;
  /**
   * Canvas background. Valid values are:
   *
   * - `undefined` - the background of "appState.viewBackgroundColor" is used.
   * - `false` - no background is used (set to "transparent").
   * - `string` - should be a valid CSS color.
   *
   * @default undefined
   */
  canvasBackgroundColor?: string | false;
  /**
   * Canvas padding in pixels. Affected by `scale`.
   *
   * When `fit` is set to `none`, padding is added to the content bounding box
   * (including if you set `width` or `height` or `maxWidthOrHeight` or
   * `widthOrHeight`).
   *
   * When `fit` set to `contain`, padding is subtracted from the content
   * bounding box (ensuring the size doesn't exceed the supplied values, with
   * the exeception of using alongside `scale` as noted above), and the padding
   * serves as a minimum distance between the content and the canvas edges, as
   * it may exceed the supplied padding value from one side or the other in
   * order to maintain the aspect ratio. It is recommended to set `position`
   * to `center` when using `fit=contain`.
   *
   * When `fit` is set to `none` and either `width` or `height` or
   * `maxWidthOrHeight` is set, padding is simply adding to the bounding box
   * and the content may overflow the canvas, thus right or bottom padding
   * may be ignored.
   *
   * @default 0
   */
  padding?: number;
  // -------------------------------------------------------------------------
  /**
   * Makes sure the canvas content fits into a frame of width/height no larger
   * than this value, while maintaining the aspect ratio.
   *
   * Final dimensions can get smaller/larger if used in conjunction with
   * `scale`.
   */
  maxWidthOrHeight?: number;
  /**
   * Scale the canvas content to be excatly this many pixels wide/tall,
   * maintaining the aspect ratio.
   *
   * Cannot be used in conjunction with `maxWidthOrHeight`.
   *
   * Final dimensions can get smaller/larger if used in conjunction with
   * `scale`.
   */
  widthOrHeight?: number;
  // -------------------------------------------------------------------------
  /**
   * Width of the frame. Supply `x` or `y` if you want to ofsset the canvas
   * content.
   *
   * If `width` omitted but `height` supplied, `width` is calculated from the
   * the content's bounding box to preserve the aspect ratio.
   *
   * Defaults to the content bounding box width when both `width` and `height`
   * are omitted.
   */
  width?: number;
  /**
   * Height of the frame.
   *
   * If `height` omitted but `width` supplied, `height` is calculated from the
   * content's bounding box to preserve the aspect ratio.
   *
   * Defaults to the content bounding box height when both `width` and `height`
   * are omitted.
   */
  height?: number;
  /**
   * Left canvas offset. By default the coordinate is relative to the canvas.
   * You can switch to content coordinates by setting `origin` to `content`.
   *
   * Defaults to the `x` postion of the content bounding box.
   */
  x?: number;
  /**
   * Top canvas offset. By default the coordinate is relative to the canvas.
   * You can switch to content coordinates by setting `origin` to `content`.
   *
   * Defaults to the `y` postion of the content bounding box.
   */
  y?: number;
  /**
   * Indicates the coordinate system of the `x` and `y` values.
   *
   * - `canvas` - `x` and `y` are relative to the canvas [0, 0] position.
   * - `content` - `x` and `y` are relative to the content bounding box.
   *
   * @default "canvas"
   */
  origin?: "canvas" | "content";
  /**
   * If dimensions specified and `x` and `y` are not specified, this indicates
   * how the canvas should be scaled.
   *
   * Behavior aligns with the `object-fit` CSS property.
   *
   * - `none`    - no scaling.
   * - `contain` - scale to fit the frame. Includes `padding`.
   *
   * If `maxWidthOrHeight` or `widthOrHeight` is set, `fit` is ignored.
   *
   * @default "contain" unless `width`, `height`, `maxWidthOrHeight`, or
   * `widthOrHeight` is specified in which case `none` is the default (can be
   * changed). If `x` or `y` are specified, `none` is forced.
   */
  fit?: "none" | "contain";
  /**
   * When either `x` or `y` are not specified, indicates how the canvas should
   * be aligned on the respective axis.
   *
   * - `none`   - canvas aligned to top left.
   * - `center` - canvas is centered on the axis which is not specified
   *              (or both).
   *
   * If `maxWidthOrHeight` or `widthOrHeight` is set, `position` is ignored.
   *
   * @default "center"
   */
  position?: "center" | "topLeft";
  // -------------------------------------------------------------------------
  /**
   * A multiplier to increase/decrease the frame dimensions
   * (content resolution).
   *
   * For example, if your canvas is 300x150 and you set scale to 2, the
   * resulting size will be 600x300.
   *
   * @default 1
   */
  scale?: number;
  /**
   * If you need to suply your own canvas, e.g. in test environments or in
   * Node.js.
   *
   * Do not set `canvas.width/height` or modify the canvas context as that's
   * handled by Excalidraw.
   *
   * Defaults to `document.createElement("canvas")`.
   */
  createCanvas?: () => HTMLCanvasElement;
  /**
   * If you want to supply `width`/`height` dynamically (or derive from the
   * content bounding box), you can use this function.
   *
   * Ignored if `maxWidthOrHeight`, `width`, or `height` is set.
   */
  getDimensions?: (
    width: number,
    height: number,
  ) => { width: number; height: number; scale?: number };

  exportingFrame?: ExcalidrawFrameLikeElement | null;

  loadFonts?: () => Promise<void>;
};

// ---------------------------------------------------------------------------
// Internal helper to configure export dimensions
// ---------------------------------------------------------------------------

const configExportDimension = async ({
  data,
  config,
}: {
  data: ExportSceneData;
  config?: ExportSceneConfig;
}) => {
  // clone
  const cfg = Object.assign({}, config);

  const { exportingFrame } = cfg;

  const elements = data.elements;

  // initialize defaults
  // ---------------------------------------------------------------------------

  const appState = restoreAppState(data.appState, null);

  const frameRendering = getFrameRenderingConfig(
    exportingFrame ?? null,
    appState.frameRendering ?? null,
  );
  // for canvas export, don't clip if exporting a specific frame as it would
  // clip the corners of the content
  if (exportingFrame) {
    frameRendering.clip = false;
  }

  const elementsForRender = prepareElementsForRender({
    elements,
    exportingFrame,
    exportWithDarkMode: appState.exportWithDarkMode,
    frameRendering,
  });

  if (exportingFrame) {
    cfg.padding = 0;
  }

  cfg.fit =
    cfg.fit ??
    (cfg.width != null ||
    cfg.height != null ||
    cfg.maxWidthOrHeight != null ||
    cfg.widthOrHeight != null
      ? "contain"
      : "none");

  cfg.padding = cfg.padding ?? 0;
  cfg.scale = cfg.scale ?? 1;

  cfg.origin = cfg.origin ?? "canvas";
  cfg.position = cfg.position ?? "center";

  if (cfg.maxWidthOrHeight != null && cfg.widthOrHeight != null) {
    if (!import.meta.env.PROD) {
      console.warn("`maxWidthOrHeight` is ignored when `widthOrHeight` is set");
    }
    cfg.maxWidthOrHeight = undefined;
  }

  if (
    (cfg.maxWidthOrHeight != null || cfg.width != null || cfg.height != null) &&
    cfg.getDimensions
  ) {
    if (!import.meta.env.PROD) {
      console.warn(
        "`getDimensions` is ignored when `width`, `height`, or `maxWidthOrHeight` is set",
      );
    }
    cfg.getDimensions = undefined;
  }
  // ---------------------------------------------------------------------------

  // load font faces before continuing, by default leverages browsers' [FontFace API](https://developer.mozilla.org/en-US/docs/Web/API/FontFace)
  if (cfg.loadFonts) {
    await cfg.loadFonts();
  } else {
    await Fonts.loadElementsFonts(elements);
  }

  // value used to scale the canvas context. By default, we use this to
  // make the canvas fit into the frame (e.g. for `cfg.fit` set to `contain`).
  // If `cfg.scale` is set, we multiply the resulting canvasScale by it to
  // scale the output further.
  let exportScale = 1;

  const origCanvasSize = getCanvasSize(
    exportingFrame ? [exportingFrame] : getRootElements(elementsForRender),
  );

  // variables for original content bounding box
  const [origX, origY, origWidth, origHeight] = origCanvasSize;
  // variables for target bounding box
  let [x, y, width, height] = origCanvasSize;

  x = cfg.x ?? x;
  y = cfg.y ?? y;
  width = cfg.width ?? width;
  height = cfg.height ?? height;

  if (cfg.fit === "contain" || cfg.widthOrHeight || cfg.maxWidthOrHeight) {
    cfg.padding =
      cfg.padding && cfg.padding > 0
        ? Math.min(
            cfg.padding,
            (width - DEFAULT_SMALLEST_EXPORT_SIZE) / 2,
            (height - DEFAULT_SMALLEST_EXPORT_SIZE) / 2,
          )
        : 0;

    if (cfg.getDimensions != null) {
      const ret = cfg.getDimensions(width, height);

      width = ret.width;
      height = ret.height;

      cfg.padding = Math.min(
        cfg.padding,
        (width - DEFAULT_SMALLEST_EXPORT_SIZE) / 2,
        (height - DEFAULT_SMALLEST_EXPORT_SIZE) / 2,
      );
    } else if (cfg.widthOrHeight != null) {
      cfg.padding = Math.min(
        cfg.padding,
        (cfg.widthOrHeight - DEFAULT_SMALLEST_EXPORT_SIZE) / 2,
      );
    } else if (cfg.maxWidthOrHeight != null) {
      cfg.padding = Math.min(
        cfg.padding,
        (cfg.maxWidthOrHeight - DEFAULT_SMALLEST_EXPORT_SIZE) / 2,
      );
    }
  }

  if (cfg.maxWidthOrHeight != null || cfg.widthOrHeight != null) {
    if (cfg.padding) {
      if (cfg.maxWidthOrHeight != null) {
        cfg.maxWidthOrHeight -= cfg.padding * 2;
      } else if (cfg.widthOrHeight != null) {
        cfg.widthOrHeight -= cfg.padding * 2;
      }
    }

    const max = Math.max(width, height);
    if (cfg.widthOrHeight != null) {
      // calculate by how much do we need to scale the canvas to fit into the
      // target dimension (e.g. target: max 50px, actual: 70x100px => scale: 0.5)
      exportScale = cfg.widthOrHeight / max;
    } else if (cfg.maxWidthOrHeight != null) {
      exportScale = cfg.maxWidthOrHeight < max ? cfg.maxWidthOrHeight / max : 1;
    }

    width *= exportScale;
    height *= exportScale;
  } else if (cfg.getDimensions) {
    const ret = cfg.getDimensions(width, height);

    width = ret.width;
    height = ret.height;
    cfg.scale = ret.scale ?? cfg.scale;
  } else if (cfg.fit === "contain") {
    width -= cfg.padding * 2;
    height -= cfg.padding * 2;

    const wRatio = width / origWidth;
    const hRatio = height / origHeight;
    // scale the orig canvas to fit in the target region
    exportScale = Math.min(wRatio, hRatio);
  }

  x = cfg.x ?? origX;
  y = cfg.y ?? origY;

  // if we switch to "content" coords, we need to offset cfg-supplied
  // coords by the x/y of content bounding box
  if (cfg.origin === "content") {
    if (cfg.x != null) {
      x += origX;
    }
    if (cfg.y != null) {
      y += origY;
    }
  }

  // Centering the content to the frame.
  // We divide width/height by canvasScale so that we calculate in the original
  // aspect ratio dimensions.
  if (cfg.position === "center") {
    x -=
      width / exportScale / 2 -
      (cfg.x == null ? origWidth : width + cfg.padding * 2) / 2;
    y -=
      height / exportScale / 2 -
      (cfg.y == null ? origHeight : height + cfg.padding * 2) / 2;
  }

  // rescale padding based on current canvasScale factor so that the resulting
  // padding is kept the same as supplied by user (with the exception of
  // `cfg.scale` being set, which also scales the padding)
  const normalizedPadding = cfg.padding / exportScale;

  // scale the whole frame by cfg.scale (on top of whatever canvasScale we
  // calculated above)
  exportScale *= cfg.scale;

  width *= cfg.scale;
  height *= cfg.scale;

  const exportWidth = width + cfg.padding * 2 * cfg.scale;
  const exportHeight = height + cfg.padding * 2 * cfg.scale;

  return {
    config: cfg,
    normalizedPadding,
    contentWidth: width,
    contentHeight: height,
    exportWidth,
    exportHeight,
    exportScale,
    x,
    y,
    elementsForRender,
    appState,
    frameRendering,
  };
};

// ---------------------------------------------------------------------------
// exportToCanvas
// ---------------------------------------------------------------------------

/**
 * This API is usually used as a precursor to searializing to Blob or PNG,
 * but can also be used to create a canvas for other purposes.
 */
export const exportToCanvas = async ({
  data,
  config,
}: {
  data: ExportSceneData;
  config?: ExportSceneConfig;
}) => {
  const {
    config: cfg,
    normalizedPadding,
    contentWidth: width,
    contentHeight: height,
    exportWidth,
    exportHeight,
    exportScale,
    x,
    y,
    elementsForRender,
    appState,
    frameRendering,
  } = await configExportDimension({ data, config });

  const canvas = cfg.createCanvas
    ? cfg.createCanvas()
    : document.createElement("canvas");

  canvas.width = exportWidth;
  canvas.height = exportHeight;

  const { imageCache } = await updateImageCache({
    imageCache: new Map(),
    fileIds: getInitializedImageElements(elementsForRender).map(
      (element) => element.fileId,
    ),
    files: data.files || {},
  });

  const theme =
    cfg.theme ?? (appState.exportWithDarkMode ? THEME.DARK : THEME.LIGHT);

  // Determine the background color for the canvas
  const viewBackgroundColor =
    cfg.canvasBackgroundColor === false
      ? // "transparent" triggers clearRect in bootstrapCanvas
        "transparent"
      : cfg.canvasBackgroundColor ||
        appState.viewBackgroundColor ||
        COLOR_WHITE;

  renderStaticScene({
    canvas,
    rc: rough.canvas(canvas),
    elementsMap: toBrandedType<RenderableElementsMap>(
      arrayToMap(elementsForRender),
    ),
    allElementsMap: toBrandedType<NonDeletedSceneElementsMap>(
      arrayToMap(syncInvalidIndices(data.elements)),
    ),
    visibleElements: elementsForRender,
    scale: exportScale,
    appState: {
      ...appState,
      frameRendering,
      width,
      height,
      offsetLeft: 0,
      offsetTop: 0,
      scrollX: -x + normalizedPadding,
      scrollY: -y + normalizedPadding,
      zoom: { value: DEFAULT_ZOOM_VALUE },
      shouldCacheIgnoreZoom: false,
      theme,
      viewBackgroundColor,
    },
    renderConfig: {
      canvasBackgroundColor: viewBackgroundColor,
      imageCache,
      renderGrid: false,
      isExporting: true,
      // empty disables embeddable rendering
      embedsValidationStatus: new Map(),
      elementsPendingErasure: new Set(),
      pendingFlowchartNodes: null,
      theme,
    },
  });

  return canvas;
};

// ---------------------------------------------------------------------------
// exportToSvg
// ---------------------------------------------------------------------------

type ExportToSvgConfig = Pick<
  ExportSceneConfig,
  | "canvasBackgroundColor"
  | "padding"
  | "theme"
  | "exportingFrame"
  | "scale"
  | "width"
  | "height"
  | "x"
  | "y"
  | "origin"
  | "fit"
  | "position"
  | "maxWidthOrHeight"
  | "widthOrHeight"
  | "getDimensions"
  | "loadFonts"
> & {
  /**
   * if true, all embeddables passed in will be rendered when possible.
   */
  renderEmbeddables?: boolean;
  skipInliningFonts?: true;
  reuseImages?: boolean;
};

const createHTMLComment = (text: string) => {
  // surrounding with spaces to maintain prettified consistency with previous
  // iterations
  // <!-- comment -->
  return document.createComment(` ${text} `);
};

export const exportToSvg = async ({
  data,
  config,
}: {
  data: ExportSceneData;
  config?: ExportToSvgConfig;
}) => {
  const {
    config: cfg,
    normalizedPadding,
    exportWidth,
    exportHeight,
    exportScale,
    x,
    y,
    elementsForRender,
    appState,
    frameRendering,
  } = await configExportDimension({ data, config });

  const offsetX = -(x - normalizedPadding);
  const offsetY = -(y - normalizedPadding);

  const { elements } = data;

  const theme =
    cfg.theme ?? (appState.exportWithDarkMode ? THEME.DARK : THEME.LIGHT);
  const exportWithDarkMode = theme === THEME.DARK;

  // ---------------------------------------------------------------------------
  // initialize SVG root element
  // ---------------------------------------------------------------------------

  const svgRoot = document.createElementNS(SVG_NS, "svg");

  svgRoot.setAttribute("version", "1.1");
  svgRoot.setAttribute("xmlns", SVG_NS);
  svgRoot.setAttribute(
    "viewBox",
    `0 0 ${exportWidth / exportScale} ${exportHeight / exportScale}`,
  );
  svgRoot.setAttribute("width", `${exportWidth}`);
  svgRoot.setAttribute("height", `${exportHeight}`);

  const defsElement = svgRoot.ownerDocument.createElementNS(SVG_NS, "defs");

  const metadataElement = svgRoot.ownerDocument.createElementNS(
    SVG_NS,
    "metadata",
  );

  svgRoot.appendChild(createHTMLComment("svg-source:excalidraw"));
  svgRoot.appendChild(metadataElement);
  svgRoot.appendChild(defsElement);

  // ---------------------------------------------------------------------------
  // scene embed
  // ---------------------------------------------------------------------------

  // we need to serialize the "original" elements before we put them through
  // the tempScene hack which duplicates and regenerates ids
  if (appState.exportEmbedScene) {
    try {
      encodeSvgBase64Payload({
        metadataElement,
        // when embedding scene, we want to embed the origionally supplied
        // elements which don't contain the temp frame labels.
        // But it also requires that the exportToSvg is being supplied with
        // only the elements that we're exporting, and no extra.
        payload: serializeAsJSON(elements, appState, data.files || {}, "local"),
      });
    } catch (error: any) {
      console.error(error);
    }
  }

  // ---------------------------------------------------------------------------
  // frame clip paths
  // ---------------------------------------------------------------------------

  const frameElements = getFrameLikeElements(elements);

  if (frameElements.length) {
    const elementsMap = arrayToMap(elements);

    for (const frame of frameElements) {
      const clipPath = svgRoot.ownerDocument.createElementNS(
        SVG_NS,
        "clipPath",
      );

      clipPath.setAttribute("id", frame.id);

      const [x1, y1, x2, y2] = getElementAbsoluteCoords(frame, elementsMap);
      const cx = (x2 - x1) / 2 - (frame.x - x1);
      const cy = (y2 - y1) / 2 - (frame.y - y1);

      const rect = svgRoot.ownerDocument.createElementNS(SVG_NS, "rect");
      rect.setAttribute(
        "transform",
        `translate(${frame.x + offsetX} ${frame.y + offsetY}) rotate(${
          frame.angle
        } ${cx} ${cy})`,
      );
      rect.setAttribute("width", `${frame.width}`);
      rect.setAttribute("height", `${frame.height}`);

      if (!cfg.exportingFrame) {
        rect.setAttribute("rx", `${FRAME_STYLE.radius}`);
        rect.setAttribute("ry", `${FRAME_STYLE.radius}`);
      }

      clipPath.appendChild(rect);

      defsElement.appendChild(clipPath);
    }
  }

  // ---------------------------------------------------------------------------
  // inline font faces
  // ---------------------------------------------------------------------------

  const fontFaces =
    config?.skipInliningFonts !== true
      ? await Fonts.generateFontFaceDeclarations(elements)
      : [];

  const delimiter = "\n      "; // 6 spaces

  const style = svgRoot.ownerDocument.createElementNS(SVG_NS, "style");
  style.classList.add("style-fonts");
  style.appendChild(
    document.createTextNode(`${delimiter}${fontFaces.join(delimiter)}`),
  );

  defsElement.appendChild(style);

  // ---------------------------------------------------------------------------
  // background
  // ---------------------------------------------------------------------------

  // render background rect
  if (appState.exportBackground && appState.viewBackgroundColor) {
    const bgColor = cfg.canvasBackgroundColor || appState.viewBackgroundColor;
    const rect = svgRoot.ownerDocument.createElementNS(SVG_NS, "rect");
    rect.setAttribute("x", "0");
    rect.setAttribute("y", "0");
    rect.setAttribute("width", `${exportWidth / exportScale}`);
    rect.setAttribute("height", `${exportHeight / exportScale}`);
    rect.setAttribute(
      "fill",
      exportWithDarkMode ? applyDarkModeFilter(bgColor) : bgColor,
    );
    svgRoot.appendChild(rect);
  }

  // ---------------------------------------------------------------------------
  // render elements
  // ---------------------------------------------------------------------------

  const rsvg = rough.svg(svgRoot);

  const renderEmbeddables = config?.renderEmbeddables ?? false;

  renderSceneToSvg(
    elementsForRender,
    toBrandedType<RenderableElementsMap>(arrayToMap(elementsForRender)),
    rsvg,
    svgRoot,
    data.files || {},
    {
      offsetX,
      offsetY,
      isExporting: true,
      exportWithDarkMode,
      renderEmbeddables,
      frameRendering,
      canvasBackgroundColor: appState.viewBackgroundColor,
      embedsValidationStatus: renderEmbeddables
        ? new Map(
            elementsForRender
              .filter((element) => isFrameLikeElement(element))
              .map((element) => [element.id, true]),
          )
        : new Map(),
      reuseImages: config?.reuseImages ?? true,
      theme,
    },
  );

  // ---------------------------------------------------------------------------

  return svgRoot;
};

// ---------------------------------------------------------------------------
// SVG payload encoding/decoding
// ---------------------------------------------------------------------------

export const encodeSvgBase64Payload = ({
  payload,
  metadataElement,
}: {
  payload: string;
  metadataElement: SVGMetadataElement;
}) => {
  const base64 = stringToBase64(
    JSON.stringify(encode({ text: payload })),
    true /* is already byte string */,
  );

  metadataElement.appendChild(
    createHTMLComment(`payload-type:${MIME_TYPES.excalidraw}`),
  );
  metadataElement.appendChild(createHTMLComment("payload-version:2"));
  metadataElement.appendChild(createHTMLComment("payload-start"));
  metadataElement.appendChild(document.createTextNode(base64));
  metadataElement.appendChild(createHTMLComment("payload-end"));
};

export const decodeSvgBase64Payload = ({ svg }: { svg: string }) => {
  if (svg.includes(`payload-type:${MIME_TYPES.excalidraw}`)) {
    const match = svg.match(
      /<!-- payload-start -->\s*(.+?)\s*<!-- payload-end -->/,
    );
    if (!match) {
      throw new Error("INVALID");
    }
    const versionMatch = svg.match(/<!-- payload-version:(\d+) -->/);
    const version = versionMatch?.[1] || "1";
    const isByteString = version !== "1";

    try {
      const json = base64ToString(match[1], isByteString);
      const encodedData = JSON.parse(json);
      if (!("encoded" in encodedData)) {
        // legacy, un-encoded scene JSON
        if (
          "type" in encodedData &&
          encodedData.type === EXPORT_DATA_TYPES.excalidraw
        ) {
          return json;
        }
        throw new Error("FAILED");
      }
      return decode(encodedData);
    } catch (error: any) {
      console.error(error);
      throw new Error("FAILED");
    }
  }
  throw new Error("INVALID");
};

// ---------------------------------------------------------------------------
// getCanvasSize
// ---------------------------------------------------------------------------

// calculate smallest area to fit the contents in
export const getCanvasSize = (
  elements: readonly NonDeletedExcalidrawElement[],
): Bounds => {
  const [minX, minY, maxX, maxY] = getCommonBounds(elements);
  const width = distance(minX, maxX);
  const height = distance(minY, maxY);

  return [minX, minY, width, height];
};

/**
 * Gets the export dimensions for a set of elements.
 *
 * @param elements - Elements to calculate size for
 * @param exportPadding - Padding to add around the elements
 * @param scale - Scale factor
 * @returns [width, height] tuple
 */
export const getExportSize = (
  elements: readonly NonDeletedExcalidrawElement[],
  exportPadding: number,
  scale: number,
): [number, number] => {
  const [, , width, height] = getCanvasSize(elements);

  return [
    Math.trunc((width + exportPadding * 2) * scale),
    Math.trunc((height + exportPadding * 2) * scale),
  ];
};

// ---------------------------------------------------------------------------
// exportToBlob
// ---------------------------------------------------------------------------

export { MIME_TYPES };

type ExportToBlobConfig = ExportSceneConfig & {
  mimeType?: string;
  quality?: number;
};

export const exportToBlob = async ({
  data,
  config,
}: {
  data: ExportSceneData;
  config?: ExportToBlobConfig;
}): Promise<Blob> => {
  let { mimeType = MIME_TYPES.png, quality } = config || {};

  if (mimeType === MIME_TYPES.png && typeof quality === "number") {
    console.warn(`"quality" will be ignored for "${MIME_TYPES.png}" mimeType`);
  }

  // typo in MIME type (should be "jpeg")
  if (mimeType === "image/jpg") {
    mimeType = MIME_TYPES.jpg;
  }

  if (mimeType === MIME_TYPES.jpg && config?.canvasBackgroundColor !== false) {
    if (config?.canvasBackgroundColor === undefined) {
      console.warn(
        `Defaulting "canvasBackgroundColor" for "${MIME_TYPES.jpg}" mimeType`,
      );
      config = {
        ...config,
        canvasBackgroundColor:
          data.appState?.viewBackgroundColor || COLOR_WHITE,
      };
    }
  }

  const canvas = await exportToCanvas({ data, config });

  quality = quality ? quality : /image\/jpe?g/.test(mimeType) ? 0.92 : 0.8;

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      async (blob) => {
        if (!blob) {
          return reject(new Error("couldn't export to blob"));
        }
        if (
          blob &&
          mimeType === MIME_TYPES.png &&
          data.appState?.exportEmbedScene
        ) {
          blob = await encodePngMetadata({
            blob,
            metadata: serializeAsJSON(
              // NOTE as long as we're using the Scene hack, we need to ensure
              // we pass the original, uncloned elements when serializing
              // so that we keep ids stable
              data.elements,
              data.appState,
              data.files || {},
              "local",
            ),
          });
        }
        resolve(blob);
      },
      mimeType,
      quality,
    );
  });
};

// ---------------------------------------------------------------------------
// exportToClipboard
// ---------------------------------------------------------------------------

export const exportToClipboard = async ({
  type,
  data,
  config,
}: {
  data: ExportSceneData;
} & (
  | { type: "png"; config?: ExportToBlobConfig }
  | { type: "svg"; config?: ExportToSvgConfig }
  | { type: "json"; config?: never }
)) => {
  if (type === "svg") {
    const svg = await exportToSvg({
      data: {
        ...data,
        appState: restoreAppState(data.appState, null),
      },
      config,
    });
    await copyTextToSystemClipboard(svg.outerHTML);
  } else if (type === "png") {
    await copyBlobToClipboardAsPng(exportToBlob({ data, config }));
  } else if (type === "json") {
    await copyToClipboard(data.elements, data.files);
  } else {
    throw new Error("Invalid export type");
  }
};

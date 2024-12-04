import rough from "roughjs/bin/rough";
import type {
  ExcalidrawElement,
  ExcalidrawFrameLikeElement,
  ExcalidrawTextElement,
  NonDeletedExcalidrawElement,
  NonDeletedSceneElementsMap,
  Theme,
} from "../element/types";
import type { Bounds } from "../element/bounds";
import { getCommonBounds, getElementAbsoluteCoords } from "../element/bounds";
import { renderSceneToSvg } from "../renderer/staticSvgScene";
import { arrayToMap, distance, getFontString, toBrandedType } from "../utils";
import type { AppState, BinaryFiles } from "../types";
import {
  COLOR_WHITE,
  DEFAULT_EXPORT_PADDING,
  DEFAULT_ZOOM_VALUE,
  FRAME_STYLE,
  FONT_FAMILY,
  SVG_NS,
  THEME,
  THEME_FILTER,
  MIME_TYPES,
} from "../constants";
import { getDefaultAppState } from "../appState";
import { serializeAsJSON } from "../data/json";
import {
  getInitializedImageElements,
  updateImageCache,
} from "../element/image";
import { restore, restoreAppState } from "../data/restore";
import {
  getElementsOverlappingFrame,
  getFrameLikeElements,
  getFrameLikeTitle,
  getRootElements,
} from "../frame";
import { getNonDeletedElements, newTextElement } from "../element";
import { type Mutable } from "../utility-types";
import { newElementWith } from "../element/mutateElement";
import { isFrameLikeElement } from "../element/typeChecks";
import type { RenderableElementsMap } from "./types";
import { syncInvalidIndices } from "../fractionalIndex";
import { renderStaticScene } from "../renderer/staticScene";
import { Fonts } from "../fonts";
import { encodePngMetadata } from "../data/image";
import {
  copyBlobToClipboardAsPng,
  copyTextToSystemClipboard,
  copyToClipboard,
} from "../clipboard";

const SVG_EXPORT_TAG = `<!-- svg-source:excalidraw -->`;

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

type ExportToCanvasAppState = Partial<
  Omit<AppState, "offsetTop" | "offsetLeft">
>;

export type ExportToCanvasData = {
  elements: readonly NonDeletedExcalidrawElement[];
  appState?: ExportToCanvasAppState;
  files: BinaryFiles | null;
};

export type ExportToCanvasConfig = {
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
   * When `fit` is set to `cover`, padding is disabled (set to 0).
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
   * - `cover`   - scale to fill the frame while maintaining aspect ratio. If
   *               content overflows, it will be cropped.
   *
   * If `maxWidthOrHeight` or `widthOrHeight` is set, `fit` is ignored.
   *
   * @default "contain" unless `width`, `height`, `maxWidthOrHeight`, or
   * `widthOrHeight` is specified in which case `none` is the default (can be
   * changed). If `x` or `y` are specified, `none` is forced.
   */
  fit?: "none" | "contain" | "cover";
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

/**
 * This API is usually used as a precursor to searializing to Blob or PNG,
 * but can also be used to create a canvas for other purposes.
 */
export const exportToCanvas = async ({
  data,
  config,
}: {
  data: ExportToCanvasData;
  config?: ExportToCanvasConfig;
}) => {
  // clone
  const cfg = Object.assign({}, config);

  const { files } = data;
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

  const containPadding = cfg.fit === "contain";

  if (cfg.x != null || cfg.x != null) {
    cfg.fit = "none";
  }

  if (cfg.fit === "cover") {
    if (cfg.padding && !import.meta.env.PROD) {
      console.warn("`padding` is ignored when `fit` is set to `cover`");
    }
    cfg.padding = 0;
  }

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
  let canvasScale = 1;

  const origCanvasSize = getCanvasSize(
    exportingFrame ? [exportingFrame] : getRootElements(elementsForRender),
  );

  // cfg.x = undefined;
  // cfg.y = undefined;

  // variables for original content bounding box
  const [origX, origY, origWidth, origHeight] = origCanvasSize;
  // variables for target bounding box
  let [x, y, width, height] = origCanvasSize;

  if (cfg.width != null) {
    width = cfg.width;

    if (cfg.padding && containPadding) {
      width -= cfg.padding * 2;
    }

    if (cfg.height) {
      height = cfg.height;
      if (cfg.padding && containPadding) {
        height -= cfg.padding * 2;
      }
    } else {
      // if height not specified, scale the original height to match the new
      // width while maintaining aspect ratio
      height *= width / origWidth;
    }
  } else if (cfg.height != null) {
    height = cfg.height;

    if (cfg.padding && containPadding) {
      height -= cfg.padding * 2;
    }
    // width not specified, so scale the original width to match the new
    // height while maintaining aspect ratio
    width *= height / origHeight;
  }

  if (cfg.maxWidthOrHeight != null || cfg.widthOrHeight != null) {
    if (containPadding && cfg.padding) {
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
      canvasScale = cfg.widthOrHeight / max;
    } else if (cfg.maxWidthOrHeight != null) {
      canvasScale = cfg.maxWidthOrHeight < max ? cfg.maxWidthOrHeight / max : 1;
    }

    width *= canvasScale;
    height *= canvasScale;
  } else if (cfg.getDimensions) {
    const ret = cfg.getDimensions(width, height);

    width = ret.width;
    height = ret.height;
    cfg.scale = ret.scale ?? cfg.scale;
  } else if (
    containPadding &&
    cfg.padding &&
    cfg.width == null &&
    cfg.height == null
  ) {
    const whRatio = width / height;
    width -= cfg.padding * 2;
    height -= (cfg.padding * 2) / whRatio;
  }

  if (
    (cfg.fit === "contain" && !cfg.maxWidthOrHeight) ||
    (containPadding && cfg.padding)
  ) {
    if (cfg.fit === "contain") {
      const wRatio = width / origWidth;
      const hRatio = height / origHeight;
      // scale the orig canvas to fit in the target frame
      canvasScale = Math.min(wRatio, hRatio);
    } else {
      const wRatio = (width - cfg.padding * 2) / width;
      const hRatio = (height - cfg.padding * 2) / height;
      canvasScale = Math.min(wRatio, hRatio);
    }
  } else if (cfg.fit === "cover") {
    const wRatio = width / origWidth;
    const hRatio = height / origHeight;
    // scale the orig canvas to fill the the target frame
    // (opposite of "contain")
    canvasScale = Math.max(wRatio, hRatio);
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
      width / canvasScale / 2 -
      (cfg.x == null ? origWidth : width + cfg.padding * 2) / 2;
    y -=
      height / canvasScale / 2 -
      (cfg.y == null ? origHeight : height + cfg.padding * 2) / 2;
  }

  const canvas = cfg.createCanvas
    ? cfg.createCanvas()
    : document.createElement("canvas");

  // rescale padding based on current canvasScale factor so that the resulting
  // padding is kept the same as supplied by user (with the exception of
  // `cfg.scale` being set, which also scales the padding)
  const normalizedPadding = cfg.padding / canvasScale;

  // scale the whole frame by cfg.scale (on top of whatever canvasScale we
  // calculated above)
  canvasScale *= cfg.scale;

  width *= cfg.scale;
  height *= cfg.scale;

  canvas.width = width + cfg.padding * 2 * cfg.scale;
  canvas.height = height + cfg.padding * 2 * cfg.scale;

  const { imageCache } = await updateImageCache({
    imageCache: new Map(),
    fileIds: getInitializedImageElements(elementsForRender).map(
      (element) => element.fileId,
    ),
    files: files || {},
  });

  renderStaticScene({
    canvas,
    rc: rough.canvas(canvas),
    elementsMap: toBrandedType<RenderableElementsMap>(
      arrayToMap(elementsForRender),
    ),
    allElementsMap: toBrandedType<NonDeletedSceneElementsMap>(
      arrayToMap(syncInvalidIndices(elements)),
    ),
    visibleElements: elementsForRender,
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
      theme: cfg.theme || THEME.LIGHT,
    },
    scale: canvasScale,
    renderConfig: {
      canvasBackgroundColor:
        cfg.canvasBackgroundColor === false
          ? // null indicates transparent background
            null
          : cfg.canvasBackgroundColor ||
            appState.viewBackgroundColor ||
            COLOR_WHITE,
      imageCache,
      renderGrid: false,
      isExporting: true,
      // empty disables embeddable rendering
      embedsValidationStatus: new Map(),
      elementsPendingErasure: new Set(),
      pendingFlowchartNodes: null,
    },
  });

  return canvas;
};

type ExportToSvgConfig = Pick<
  ExportToCanvasConfig,
  "canvasBackgroundColor" | "padding" | "theme" | "exportingFrame"
> & {
  /**
   * if true, all embeddables passed in will be rendered when possible.
   */
  renderEmbeddables?: boolean;
  skipInliningFonts?: true;
  reuseImages?: boolean;
};

export const exportToSvg = async ({
  data,
  config,
}: {
  data: {
    elements: readonly NonDeletedExcalidrawElement[];
    appState: {
      exportBackground: boolean;
      exportScale?: number;
      viewBackgroundColor: string;
      exportWithDarkMode?: boolean;
      exportEmbedScene?: boolean;
      frameRendering?: AppState["frameRendering"];
      gridModeEnabled?: boolean;
    };
    files: BinaryFiles | null;
  };
  config?: ExportToSvgConfig;
}): Promise<SVGSVGElement> => {
  // clone
  const cfg = Object.assign({}, config);

  cfg.exportingFrame = cfg.exportingFrame ?? null;

  const { elements: restoredElements } = restore(
    { ...data, files: data.files || {} },
    null,
    null,
  );
  const elements = getNonDeletedElements(restoredElements);

  const frameRendering = getFrameRenderingConfig(
    cfg?.exportingFrame ?? null,
    data.appState.frameRendering ?? null,
  );

  let {
    exportWithDarkMode = false,
    viewBackgroundColor,
    exportScale = 1,
    exportEmbedScene,
  } = data.appState;

  let padding = cfg.padding ?? 0;

  const elementsForRender = prepareElementsForRender({
    elements,
    exportingFrame: cfg.exportingFrame,
    exportWithDarkMode,
    frameRendering,
  });

  if (cfg.exportingFrame) {
    padding = 0;
  }

  let metadata = "";

  // we need to serialize the "original" elements before we put them through
  // the tempScene hack which duplicates and regenerates ids
  if (exportEmbedScene) {
    try {
      metadata = (await import("../data/image")).encodeSvgMetadata({
        // when embedding scene, we want to embed the origionally supplied
        // elements which don't contain the temp frame labels.
        // But it also requires that the exportToSvg is being supplied with
        // only the elements that we're exporting, and no extra.
        text: serializeAsJSON(
          elements,
          data.appState,
          data.files || {},
          "local",
        ),
      });
    } catch (error: any) {
      console.error(error);
    }
  }

  let [minX, minY, width, height] = getCanvasSize(
    cfg.exportingFrame
      ? [cfg.exportingFrame]
      : getRootElements(elementsForRender),
  );

  width += padding * 2;
  height += padding * 2;

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

  const offsetX = -minX + padding;
  const offsetY = -minY + padding;

  const frameElements = getFrameLikeElements(elements);

  let exportingFrameClipPath = "";
  const elementsMap = arrayToMap(elements);
  for (const frame of frameElements) {
    const [x1, y1, x2, y2] = getElementAbsoluteCoords(frame, elementsMap);
    const cx = (x2 - x1) / 2 - (frame.x - x1);
    const cy = (y2 - y1) / 2 - (frame.y - y1);

    exportingFrameClipPath += `<clipPath id=${frame.id}>
            <rect transform="translate(${frame.x + offsetX} ${
      frame.y + offsetY
    }) rotate(${frame.angle} ${cx} ${cy})"
          width="${frame.width}"
          height="${frame.height}"
          ${
            cfg.exportingFrame
              ? ""
              : `rx=${FRAME_STYLE.radius} ry=${FRAME_STYLE.radius}`
          }
          >
          </rect>
        </clipPath>`;
  }

  const fontFaces = !cfg?.skipInliningFonts
    ? await Fonts.generateFontFaceDeclarations(elements)
    : [];

  const delimiter = "\n      "; // 6 spaces

  svgRoot.innerHTML = `
  ${SVG_EXPORT_TAG}
  ${metadata}
  <defs>
    <style class="style-fonts">${delimiter}${fontFaces.join(delimiter)}
    </style>
    ${exportingFrameClipPath}
  </defs>
  `;

  // render background rect
  if (data.appState.exportBackground && viewBackgroundColor) {
    const rect = svgRoot.ownerDocument!.createElementNS(SVG_NS, "rect");
    rect.setAttribute("x", "0");
    rect.setAttribute("y", "0");
    rect.setAttribute("width", `${width}`);
    rect.setAttribute("height", `${height}`);
    rect.setAttribute("fill", viewBackgroundColor);
    svgRoot.appendChild(rect);
  }

  const rsvg = rough.svg(svgRoot);

  const renderEmbeddables = cfg.renderEmbeddables ?? false;

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
      canvasBackgroundColor: viewBackgroundColor,
      embedsValidationStatus: renderEmbeddables
        ? new Map(
            elementsForRender
              .filter((element) => isFrameLikeElement(element))
              .map((element) => [element.id, true]),
          )
        : new Map(),
      reuseImages: cfg?.reuseImages ?? true,
    },
  );

  return svgRoot;
};

// calculate smallest area to fit the contents in
export const getCanvasSize = (
  elements: readonly NonDeletedExcalidrawElement[],
): Bounds => {
  const [minX, minY, maxX, maxY] = getCommonBounds(elements);
  const width = distance(minX, maxX);
  const height = distance(minY, maxY);

  return [minX, minY, width, height];
};

export { MIME_TYPES };

type ExportToBlobConfig = ExportToCanvasConfig & {
  mimeType?: string;
  quality?: number;
};

export const exportToBlob = async ({
  data,
  config,
}: {
  data: ExportToCanvasData;
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

  if (mimeType === MIME_TYPES.jpg && !config?.canvasBackgroundColor === false) {
    console.warn(
      `Defaulting "exportBackground" to "true" for "${MIME_TYPES.jpg}" mimeType`,
    );
    config = {
      ...config,
      canvasBackgroundColor: data.appState?.viewBackgroundColor || COLOR_WHITE,
    };
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

export const exportToClipboard = async ({
  type,
  data,
  config,
}: {
  data: ExportToCanvasData;
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

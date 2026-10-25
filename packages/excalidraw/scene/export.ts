import rough from "roughjs/bin/rough";

import {
  FRAME_STYLE,
  FONT_FAMILY,
  SVG_NS,
  THEME,
  MIME_TYPES,
  EXPORT_DATA_TYPES,
  COLOR_WHITE,
  DEFAULT_EXPORT_PADDING,
  arrayToMap,
  distance,
  getFontString,
  toBrandedType,
  applyDarkModeFilter,
  removeDarkModeFilter,
} from "@excalidraw/common";

import { getCommonBounds, getElementAbsoluteCoords } from "@excalidraw/element";

import {
  getInitializedImageElements,
  getLineWidth,
  getNonDeletedElements,
  getRenderEnvironment,
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

import type { RenderEnvironment } from "@excalidraw/element";

import type {
  ExcalidrawFrameLikeElement,
  ExcalidrawTextElement,
  NonDeleted,
  NonDeletedExcalidrawElement,
  NonDeletedSceneElementsMap,
  Theme,
} from "@excalidraw/element/types";

import { cleanAppStateForExport } from "../appState";
import { base64ToString, decode, encode, stringToBase64 } from "../data/encode";
import { serializeAsJSON } from "../data/json";
import { restoreAppState, restoreElements } from "../data/restore";
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

/**
 * Padding is taken from the target size when fitting into one: keep at least
 * `DEFAULT_SMALLEST_EXPORT_SIZE` of each target dimension for the content.
 */
const clampPadding = (padding: number, targets: readonly number[]) =>
  Math.max(
    0,
    Math.min(
      padding,
      ...targets.map((target) => (target - DEFAULT_SMALLEST_EXPORT_SIZE) / 2),
    ),
  );
const DEFAULT_ZOOM_VALUE = 1 as NormalizedZoomValue;

const truncateText = (
  element: NonDeleted<ExcalidrawTextElement>,
  maxWidth: number,
  renderEnvironment: RenderEnvironment,
) => {
  if (element.width <= maxWidth) {
    return element;
  }
  const font = getFontString({
    fontFamily: element.fontFamily,
    fontSize: element.fontSize,
  });

  let text = element.text;

  if (getLineWidth(text, font, renderEnvironment) > maxWidth) {
    // we iterate from the right, removing characters one by one instead
    // of building the string up. This assumes that it's more likely
    // your frame names will overflow by not that many characters
    // (if ever), so it should be faster this way. Down to just the ellipsis,
    // and no label at all where even that overflows the frame.
    let truncated = "";
    for (let i = text.length; i >= 0; i--) {
      const newText = `${text.slice(0, i)}...`;
      if (getLineWidth(newText, font, renderEnvironment) <= maxWidth) {
        truncated = newText;
        break;
      }
    }
    text = truncated;
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
  opts: { theme: Theme; renderEnvironment: RenderEnvironment },
) => {
  const nextElements: NonDeletedExcalidrawElement[] = [];
  for (const element of elements) {
    if (isFrameLikeElement(element)) {
      let textElement: Mutable<NonDeleted<ExcalidrawTextElement>> =
        newTextElement({
          x: element.x,
          y: element.y - FRAME_STYLE.nameOffsetY,
          fontFamily: FONT_FAMILY.Helvetica,
          fontSize: FRAME_STYLE.nameFontSize,
          lineHeight:
            FRAME_STYLE.nameLineHeight as ExcalidrawTextElement["lineHeight"],
          strokeColor:
            opts.theme === THEME.DARK
              ? // the renderer applies the dark mode filter to element
                // colors, so revert it upfront to end up with the color
                // the editor uses for frame names
                removeDarkModeFilter(FRAME_STYLE.nameColorDarkTheme)
              : FRAME_STYLE.nameColorLightTheme,
          text: getFrameLikeTitle(element),
          renderEnvironment: opts.renderEnvironment,
        });
      textElement.y -= textElement.height;

      textElement = truncateText(
        textElement,
        element.width,
        opts.renderEnvironment,
      );

      nextElements.push(textElement);
    }
    nextElements.push(element);
  }

  return nextElements;
};

const getFrameRenderingConfig = (
  exportingFrame: ExcalidrawFrameLikeElement | null,
  frames: ExportSceneBaseConfig["frames"],
): AppState["frameRendering"] => ({
  enabled: true,
  outline: exportingFrame ? false : frames?.outline ?? true,
  name: exportingFrame ? false : frames?.name ?? true,
  clip: exportingFrame ? true : frames?.clip ?? true,
});

const prepareElementsForRender = ({
  elements,
  exportingFrame,
  frameRendering,
  theme,
  renderEnvironment,
}: {
  elements: readonly NonDeletedExcalidrawElement[];
  exportingFrame: ExcalidrawFrameLikeElement | null | undefined;
  frameRendering: AppState["frameRendering"];
  theme: Theme;
  renderEnvironment: RenderEnvironment;
}) => {
  let nextElements: readonly NonDeletedExcalidrawElement[];

  if (exportingFrame) {
    nextElements = getElementsOverlappingFrame(
      elements,
      exportingFrame,
      arrayToMap(elements),
    );
  } else if (frameRendering.enabled && frameRendering.name) {
    nextElements = addFrameLabelsAsTextElements(elements, {
      theme,
      renderEnvironment,
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
  /**
   * The scene settings a `.excalidraw` file stores (`viewBackgroundColor`,
   * grid settings) — not editor state. Used as the default background
   * (`canvasBackgroundColor`) and embedded with the scene (`embedScene`).
   * Anything else passed in is ignored; rendering options go to `config`.
   */
  appState?: ReturnType<typeof cleanAppStateForExport>;
  files?: BinaryFiles | null;
};

/**
 * The host capabilities an export uses, shared by every format: e.g. for test
 * environments, Node.js or another window.
 *
 * Unlike the editor's `renderEnvironment` prop, this needn't be the same
 * object across exports (e.g. on a server): exports draw without the element
 * caches keyed by an environment, and measure little text. Passing a complete
 * one (`createCanvas` and `createImage`) as-is, as the editor does, only keeps
 * its measuring caches warm.
 */
type ExportEnvironment = {
  /**
   * Creates the canvas a canvas/PNG/JPEG export renders into, and any canvas
   * the export measures text with (e.g. frame labels, embed placeholders).
   *
   * Do not set `canvas.width/height` or modify the canvas context as that's
   * handled by Excalidraw.
   *
   * Defaults to `document.createElement("canvas")`.
   */
  createCanvas?: RenderEnvironment["createCanvas"];
  /**
   * Creates the images that image elements are decoded into.
   *
   * Defaults to `new Image()`.
   */
  createImage?: RenderEnvironment["createImage"];
  /**
   * Creates the paths that freedraw elements are filled through.
   *
   * Defaults to the global `Path2D`.
   */
  createPath?: RenderEnvironment["createPath"];
  /**
   * The document an SVG export is built in, e.g. a popout window's or,
   * outside the browser, a DOM implementation's (such as `linkedom`).
   *
   * Defaults to the global `document`.
   */
  document?: RenderEnvironment["document"];
  /**
   * Measures text (frame labels, embed placeholders), e.g. where there is no
   * canvas to measure on.
   *
   * Defaults to the global provider set with `setCustomTextMetricsProvider`,
   * else to measuring on a canvas from `createCanvas`.
   */
  textMetrics?: RenderEnvironment["textMetrics"];
  /**
   * Loads the fonts the exported elements use, before rendering.
   *
   * Defaults to loading them through the browser's
   * [FontFace API](https://developer.mozilla.org/en-US/docs/Web/API/FontFace).
   */
  loadFonts?: () => Promise<void>;
};

type ExportSceneBaseConfig = {
  /**
   * @default "light"
   */
  theme?: Theme;
  /**
   * Canvas background. Valid values are:
   *
   * - `undefined` - the background of "appState.viewBackgroundColor" is used.
   * - `false` - no background is used (transparent). Not supported for JPEG,
   *   which falls back to the default.
   * - `string` - should be a valid CSS color.
   *
   * Specified in light-theme terms: `theme: "dark"` transforms it like any
   * other scene color. Only affects the rendered image, not the embedded
   * scene (`embedScene`).
   *
   * @default undefined
   */
  canvasBackgroundColor?: string | false;
  /**
   * Canvas padding in pixels. Affected by `scale`.
   *
   * When `fit` is `none`, padding is added around the content bounding box,
   * or around the `width`/`height` frame if set — in which case the content
   * may overflow the frame, thus right or bottom padding may be ignored.
   *
   * When `fit` is `contain`, or `maxWidthOrHeight`/`widthOrHeight` is set,
   * padding is subtracted from the target size (so the export doesn't exceed
   * it, `scale` aside), and serves as a minimum distance between the content
   * and the canvas edges — it may be exceeded on one axis to maintain the
   * aspect ratio. It is recommended to set `position` to `center` when using
   * `fit: "contain"`.
   *
   * @default 10
   */
  padding?: number;
  // -------------------------------------------------------------------------
  /**
   * A multiplier to increase/decrease the frame dimensions
   * (content resolution).
   *
   * For example, if your canvas is 300x150 and you set scale to 2, the
   * resulting size will be 600x300.
   *
   * Can be a function, which receives the export dimensions at scale 1
   * (padding included) and returns the multiplier — e.g. to cap the output
   * by a pixel budget.
   *
   * @default 1
   */
  scale?: number | ((width: number, height: number) => number);
  /**
   * Host environment overrides, e.g. for test environments or Node.js.
   */
  environment?: ExportEnvironment;

  exportingFrame?: NonDeleted<ExcalidrawFrameLikeElement> | null;
  /**
   * Which frame decorations to render. Ignored when exporting a single frame
   * (`exportingFrame`), which renders neither its name nor outline, and clips
   * to it.
   *
   * @default { name: true, outline: true, clip: true }
   */
  frames?: { name?: boolean; outline?: boolean; clip?: boolean };
};

/**
 * The ways to size the export — only one can be used. The positioning options
 * (`fit`, `position`, `x`, `y`, `origin`) belong to `width`/`height` (or no
 * size option).
 */
type ExportSizeOptions = {
  /**
   * Makes sure the canvas content fits into a frame of width/height no larger
   * than this value, while maintaining the aspect ratio.
   *
   * Final dimensions can get smaller/larger if used in conjunction with
   * `scale`.
   *
   * Can't be combined with `width`/`height`, `widthOrHeight`, or the
   * positioning options (`fit`, `position`, `x`, `y`, `origin`).
   */
  maxWidthOrHeight?: number;
  /**
   * Scale the canvas content to be exactly this many pixels wide/tall,
   * maintaining the aspect ratio.
   *
   * Final dimensions can get smaller/larger if used in conjunction with
   * `scale`.
   *
   * Can't be combined with `width`/`height`, `maxWidthOrHeight`, or the
   * positioning options (`fit`, `position`, `x`, `y`, `origin`).
   */
  widthOrHeight?: number;
  /**
   * Width of the frame. Supply `x` or `y` if you want to offset the canvas
   * content.
   *
   * If `width` omitted but `height` supplied, `width` is calculated from the
   * content's aspect ratio when `fit` is `contain` (the default), or is the
   * content bounding box width when `fit` is `none`.
   *
   * Defaults to the content bounding box width when both `width` and `height`
   * are omitted.
   *
   * Can't be combined with `maxWidthOrHeight` or `widthOrHeight`.
   */
  width?: number;
  /**
   * Height of the frame.
   *
   * If `height` omitted but `width` supplied, `height` is calculated from the
   * content's aspect ratio when `fit` is `contain` (the default), or is the
   * content bounding box height when `fit` is `none`.
   *
   * Defaults to the content bounding box height when both `width` and `height`
   * are omitted.
   *
   * Can't be combined with `maxWidthOrHeight` or `widthOrHeight`.
   */
  height?: number;
  // -------------------------------------------------------------------------
  /**
   * Left edge of the exported region (`padding` is added around it). By
   * default the coordinate is relative to the canvas. You can switch to
   * content coordinates by setting `origin` to `content`.
   *
   * Defaults to the `x` position of the content bounding box.
   *
   * Can't be combined with `maxWidthOrHeight` or `widthOrHeight`, and is
   * ignored with `fit: "contain"`, so setting `x` or `y` makes `fit` default
   * to `none` (cropping the region).
   */
  x?: number;
  /**
   * Top edge of the exported region (`padding` is added around it). By
   * default the coordinate is relative to the canvas. You can switch to
   * content coordinates by setting `origin` to `content`.
   *
   * Defaults to the `y` position of the content bounding box.
   *
   * Can't be combined with `maxWidthOrHeight` or `widthOrHeight`, and is
   * ignored with `fit: "contain"`, so setting `x` or `y` makes `fit` default
   * to `none` (cropping the region).
   */
  y?: number;
  /**
   * Indicates the coordinate system of the `x` and `y` values.
   *
   * - `canvas` - `x` and `y` are relative to the canvas [0, 0] position.
   * - `content` - `x` and `y` are relative to the content bounding box.
   *
   * Can't be combined with `maxWidthOrHeight` or `widthOrHeight`.
   *
   * @default "canvas"
   */
  origin?: "canvas" | "content";
  /**
   * How the content should be scaled into the `width`/`height` frame.
   *
   * Behavior aligns with the `object-fit` CSS property.
   *
   * - `none`    - no scaling.
   * - `contain` - scale to fit the frame. Includes `padding`.
   *
   * Can't be combined with `maxWidthOrHeight` or `widthOrHeight`.
   *
   * @default "contain" if `width` or `height` is set (and `x`/`y` aren't),
   * otherwise "none"
   */
  fit?: "none" | "contain";
  /**
   * When either `x` or `y` are not specified, indicates how the canvas should
   * be aligned on the respective axis.
   *
   * - `topLeft` - canvas aligned to top left.
   * - `center`  - canvas is centered on the axis which is not specified
   *               (or both).
   *
   * Can't be combined with `maxWidthOrHeight` or `widthOrHeight`.
   *
   * @default "center"
   */
  position?: "center" | "topLeft";
};

type ExportSizeOption<K extends keyof ExportSizeOptions> = Pick<
  ExportSizeOptions,
  K
> & {
  // remapping over `keyof` (rather than `Exclude<keyof …>`) keeps the
  // properties' JSDoc in editor hovers & completions
  [P in keyof ExportSizeOptions as P extends K ? never : P]?: never;
};

type ExportSizeConfig =
  | ExportSizeOption<
      "width" | "height" | "fit" | "position" | "x" | "y" | "origin"
    >
  | ExportSizeOption<"maxWidthOrHeight">
  | ExportSizeOption<"widthOrHeight">;

export type ExportSceneConfig = ExportSceneBaseConfig & ExportSizeConfig;

/**
 * The render environment of an export: `config.environment` over the browser
 * defaults.
 */
const getExportRenderEnvironment = (
  environment: ExportEnvironment | undefined,
): RenderEnvironment => {
  // a complete one (e.g. the editor's) is used as-is, keeping the caches
  // keyed by its identity
  if (environment?.createCanvas && environment.createImage) {
    return environment as RenderEnvironment;
  }
  const defaults = getRenderEnvironment();
  return {
    createCanvas: environment?.createCanvas ?? defaults.createCanvas,
    createImage: environment?.createImage ?? defaults.createImage,
    createPath: environment?.createPath ?? defaults.createPath,
    document: environment?.document ?? defaults.document,
    textMetrics: environment?.textMetrics ?? defaults.textMetrics,
  };
};

/**
 * The export config the editor's export settings translate to. Internal: hosts
 * pass their own config.
 */
export const getExportConfigFromAppState = (
  appState: Pick<
    AppState,
    | "exportWithDarkMode"
    | "exportBackground"
    | "viewBackgroundColor"
    | "exportScale"
    | "frameRendering"
  >,
) => ({
  theme: appState.exportWithDarkMode ? THEME.DARK : THEME.LIGHT,
  canvasBackgroundColor: appState.exportBackground
    ? appState.viewBackgroundColor
    : (false as const),
  scale: appState.exportScale,
  frames: appState.frameRendering.enabled
    ? appState.frameRendering
    : { name: false, outline: false, clip: false },
});

// ---------------------------------------------------------------------------
// Internal helper to configure export dimensions
// ---------------------------------------------------------------------------

const configExportDimension = async ({
  data,
  config,
  renderEnvironment,
}: {
  data: ExportSceneData;
  config?: ExportSceneConfig;
  /** measures what the export adds (frame labels) */
  renderEnvironment: RenderEnvironment;
}) => {
  // clone (widened, as the size options get normalized below)
  const cfg: ExportSceneBaseConfig & ExportSizeOptions = Object.assign(
    {},
    config,
  );

  const { exportingFrame } = cfg;

  // restore elements (normalizes & drops invisible elements) and filter out
  // deleted ones. The type contract requires non-deleted elements already,
  // but types alone don't protect JS consumers passing raw scene data.
  // These are also what SVG export embeds (`embedScene`).
  const elements = getNonDeletedElements(
    restoreElements(data.elements, null, { deleteInvisibleElements: true }),
  );

  // initialize defaults
  // ---------------------------------------------------------------------------

  // only the scene settings a file stores are taken from `data.appState`, so
  // that editor state passed in (e.g. a live AppState) can't affect the
  // output; everything else the renderers read is a default
  const appState = restoreAppState(
    cleanAppStateForExport(data.appState ?? {}),
    null,
  );

  const theme = cfg.theme ?? THEME.LIGHT;

  // the background the scene is rendered against. Used even when the
  // background isn't painted, to fake holes in elements (e.g. outline
  // arrowheads covering the arrow's shaft), so they keep looking the same.
  const backgroundColor =
    cfg.canvasBackgroundColor || appState.viewBackgroundColor || COLOR_WHITE;
  // "transparent" = no background (also when the scene's background is set
  // to transparent)
  const paintedBackgroundColor =
    cfg.canvasBackgroundColor === false ? "transparent" : backgroundColor;

  const frameRendering = getFrameRenderingConfig(
    exportingFrame ?? null,
    cfg.frames,
  );
  // when exporting a frame, everything drawn is clipped to the frame as a
  // whole, with square corners (see `exportToCanvas`/`exportToSvg`) — the
  // per-element frame clips would round the corners of the content
  if (exportingFrame) {
    frameRendering.clip = false;
  }

  const elementsForRender = prepareElementsForRender({
    elements,
    exportingFrame,
    theme,
    frameRendering,
    renderEnvironment,
  });

  if (exportingFrame) {
    cfg.padding = 0;
  }

  // treat non-positive dimension constraints as unset (matches the previous
  // API behavior where `maxWidthOrHeight: 0` was ignored), otherwise they'd
  // result in degenerate (zero/negative) canvas dimensions
  if (cfg.maxWidthOrHeight != null && cfg.maxWidthOrHeight <= 0) {
    cfg.maxWidthOrHeight = undefined;
  }
  if (cfg.widthOrHeight != null && cfg.widthOrHeight <= 0) {
    cfg.widthOrHeight = undefined;
  }

  // an explicit `x`/`y` region is cropped rather than scaled by default
  cfg.fit =
    cfg.fit ??
    (cfg.x == null &&
    cfg.y == null &&
    (cfg.width != null ||
      cfg.height != null ||
      cfg.maxWidthOrHeight != null ||
      cfg.widthOrHeight != null)
      ? "contain"
      : "none");

  cfg.padding = cfg.padding ?? DEFAULT_EXPORT_PADDING;

  cfg.origin = cfg.origin ?? "canvas";
  cfg.position = cfg.position ?? "center";

  if (cfg.maxWidthOrHeight != null && cfg.widthOrHeight != null) {
    if (!import.meta.env.PROD) {
      console.warn("`maxWidthOrHeight` is ignored when `widthOrHeight` is set");
    }
    cfg.maxWidthOrHeight = undefined;
  }

  if (
    (cfg.x != null || cfg.y != null) &&
    (cfg.fit === "contain" ||
      cfg.maxWidthOrHeight != null ||
      cfg.widthOrHeight != null)
  ) {
    if (!import.meta.env.PROD) {
      console.warn(
        '`x`/`y` are ignored when the content is scaled to fit (`fit: "contain"`, `maxWidthOrHeight`, or `widthOrHeight`)',
      );
    }
    cfg.x = undefined;
    cfg.y = undefined;
  }

  // ---------------------------------------------------------------------------

  // load font faces before continuing, by default leverages browsers' [FontFace API](https://developer.mozilla.org/en-US/docs/Web/API/FontFace)
  if (cfg.environment?.loadFonts) {
    await cfg.environment.loadFonts();
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

  // clamp against the target being fitted into (not the content: a flat
  // content axis mustn't zero the padding), before deriving from it
  if (cfg.widthOrHeight != null) {
    cfg.padding = clampPadding(cfg.padding, [cfg.widthOrHeight]);
  } else if (cfg.maxWidthOrHeight != null) {
    cfg.padding = clampPadding(cfg.padding, [cfg.maxWidthOrHeight]);
  } else if (cfg.fit === "contain") {
    cfg.padding = clampPadding(
      cfg.padding,
      cfg.width != null || cfg.height != null
        ? [cfg.width, cfg.height].filter((size): size is number => size != null)
        : [width, height],
    );
  }

  // with `contain`, derive a missing `width`/`height` from the content's
  // aspect ratio (keeping the padding the same on all sides)
  if (cfg.fit === "contain") {
    if (cfg.width != null && cfg.height == null && origWidth > 0) {
      height =
        ((cfg.width - cfg.padding * 2) * origHeight) / origWidth +
        cfg.padding * 2;
    } else if (cfg.height != null && cfg.width == null && origHeight > 0) {
      width =
        ((cfg.height - cfg.padding * 2) * origWidth) / origHeight +
        cfg.padding * 2;
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
  } else if (cfg.fit === "contain") {
    width -= cfg.padding * 2;
    height -= cfg.padding * 2;

    // scale the orig canvas to fit in the target region (a content axis of
    // zero extent, e.g. a horizontal line's height, doesn't constrain it)
    exportScale = Math.min(
      origWidth > 0 ? width / origWidth : Infinity,
      origHeight > 0 ? height / origHeight : Infinity,
    );
    if (!Number.isFinite(exportScale)) {
      exportScale = 1;
    }
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
  // Only on the axes not pinned by `x`/`y`, so that a region gets padding on
  // all sides.
  if (cfg.position === "center") {
    if (cfg.x == null) {
      x -= width / exportScale / 2 - origWidth / 2;
    }
    if (cfg.y == null) {
      y -= height / exportScale / 2 - origHeight / 2;
    }
  }

  // rescale padding based on current canvasScale factor so that the resulting
  // padding is kept the same as supplied by user (with the exception of
  // `cfg.scale` being set, which also scales the padding)
  const normalizedPadding = cfg.padding / exportScale;

  // a `scale` function sizes the export by its dimensions at scale 1
  const scale =
    typeof cfg.scale === "function"
      ? cfg.scale(width + cfg.padding * 2, height + cfg.padding * 2)
      : cfg.scale ?? 1;

  // scale the whole frame by `scale` (on top of whatever canvasScale we
  // calculated above)
  exportScale *= scale;

  width *= scale;
  height *= scale;

  const exportWidth = width + cfg.padding * 2 * scale;
  const exportHeight = height + cfg.padding * 2 * scale;

  return {
    config: cfg,
    // the restored & non-deleted-filtered elements — use these (not
    // `data.elements`) for all rendering purposes
    elements,
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
    backgroundColor,
    paintedBackgroundColor,
    theme,
  };
};

// ---------------------------------------------------------------------------
// exportToCanvas
// ---------------------------------------------------------------------------

const exportToCanvas = async ({
  data,
  config,
}: {
  data: ExportSceneData;
  config?: ExportSceneConfig;
}) => {
  const renderEnvironment = getExportRenderEnvironment(config?.environment);

  const {
    config: cfg,
    elements,
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
    backgroundColor,
    paintedBackgroundColor,
    theme,
  } = await configExportDimension({ data, config, renderEnvironment });

  const canvas = renderEnvironment.createCanvas();

  // round rather than letting the canvas truncate, which would turn float
  // noise (e.g. 28.999999999999996) into a pixel lost
  canvas.width = Math.max(1, Math.round(exportWidth));
  canvas.height = Math.max(1, Math.round(exportHeight));

  const { imageCache } = await updateImageCache({
    imageCache: new Map(),
    fileIds: getInitializedImageElements(elementsForRender).map(
      (element) => element.fileId,
    ),
    files: data.files || {},
    createImage: renderEnvironment.createImage,
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
      // "transparent" makes bootstrapCanvas clear the canvas
      viewBackgroundColor: paintedBackgroundColor,
    },
    renderConfig: {
      canvasBackgroundColor: backgroundColor,
      clipToFrame: cfg.exportingFrame ?? null,
      scale: exportScale,
      renderEnvironment,
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
  ExportSceneBaseConfig,
  | "canvasBackgroundColor"
  | "padding"
  | "theme"
  | "exportingFrame"
  | "scale"
  | "frames"
  | "environment"
> &
  ExportSizeConfig & {
    /**
     * if true, all embeddables passed in will be rendered when possible.
     */
    renderEmbeddables?: boolean;
    skipInliningFonts?: true;
    reuseImages?: boolean;
    /**
     * Embeds the scene into the SVG, so that it can be imported back into
     * Excalidraw.
     */
    embedScene?: boolean;
  };

const createHTMLComment = (ownerDocument: Document, text: string) => {
  // surrounding with spaces to maintain prettified consistency with previous
  // iterations
  // <!-- comment -->
  return ownerDocument.createComment(` ${text} `);
};

const exportToSvg = async ({
  data,
  config,
}: {
  data: ExportSceneData;
  config?: ExportToSvgConfig;
}) => {
  const renderEnvironment = getExportRenderEnvironment(config?.environment);

  const ownerDocument =
    renderEnvironment.document ??
    (typeof document !== "undefined" ? document : null);

  if (!ownerDocument) {
    throw new Error(
      "exportScene: no document to build the SVG in. Pass " +
        "`config.environment.document` when running outside the browser.",
    );
  }

  const {
    config: cfg,
    elements,
    normalizedPadding,
    exportWidth,
    exportHeight,
    exportScale,
    x,
    y,
    elementsForRender,
    appState,
    frameRendering,
    backgroundColor,
    paintedBackgroundColor,
    theme,
  } = await configExportDimension({ data, config, renderEnvironment });

  const offsetX = -(x - normalizedPadding);
  const offsetY = -(y - normalizedPadding);

  const exportWithDarkMode = theme === THEME.DARK;

  // ---------------------------------------------------------------------------
  // initialize SVG root element
  // ---------------------------------------------------------------------------

  const svgRoot = ownerDocument.createElementNS(SVG_NS, "svg");

  svgRoot.setAttribute("version", "1.1");
  svgRoot.setAttribute("xmlns", SVG_NS);
  svgRoot.setAttribute(
    "viewBox",
    `0 0 ${exportWidth / exportScale} ${exportHeight / exportScale}`,
  );
  svgRoot.setAttribute("width", `${exportWidth}`);
  svgRoot.setAttribute("height", `${exportHeight}`);

  const defsElement = ownerDocument.createElementNS(SVG_NS, "defs");

  const metadataElement = ownerDocument.createElementNS(SVG_NS, "metadata");

  svgRoot.appendChild(
    createHTMLComment(ownerDocument, "svg-source:excalidraw"),
  );
  svgRoot.appendChild(metadataElement);
  svgRoot.appendChild(defsElement);

  // ---------------------------------------------------------------------------
  // scene embed
  // ---------------------------------------------------------------------------

  // we need to serialize the "original" elements before we put them through
  // the tempScene hack which duplicates and regenerates ids
  if (config?.embedScene) {
    try {
      encodeSvgBase64Payload({
        metadataElement,
        // when embedding scene, we want to embed the (restored) supplied
        // elements which don't contain the temp frame labels. Restoring
        // keeps the ids stable. But it also requires that the exportToSvg is
        // being supplied with only the elements that we're exporting, and
        // no extra.
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
  const { exportingFrame } = cfg;
  if (
    exportingFrame &&
    !frameElements.some((frame) => frame.id === exportingFrame.id)
  ) {
    frameElements.push(exportingFrame);
  }

  if (frameElements.length) {
    const elementsMap = arrayToMap(elements);

    for (const frame of frameElements) {
      const clipPath = ownerDocument.createElementNS(SVG_NS, "clipPath");

      clipPath.setAttribute("id", frame.id);

      const [x1, y1, x2, y2] = getElementAbsoluteCoords(frame, elementsMap);
      const cx = (x2 - x1) / 2 - (frame.x - x1);
      const cy = (y2 - y1) / 2 - (frame.y - y1);

      const rect = ownerDocument.createElementNS(SVG_NS, "rect");
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

  const style = ownerDocument.createElementNS(SVG_NS, "style");
  style.classList.add("style-fonts");
  style.appendChild(
    ownerDocument.createTextNode(`${delimiter}${fontFaces.join(delimiter)}`),
  );

  defsElement.appendChild(style);

  // ---------------------------------------------------------------------------
  // background
  // ---------------------------------------------------------------------------

  // render background rect
  if (paintedBackgroundColor !== "transparent") {
    const rect = ownerDocument.createElementNS(SVG_NS, "rect");
    rect.setAttribute("x", "0");
    rect.setAttribute("y", "0");
    rect.setAttribute("width", `${exportWidth / exportScale}`);
    rect.setAttribute("height", `${exportHeight / exportScale}`);
    rect.setAttribute(
      "fill",
      applyDarkModeFilter(paintedBackgroundColor, exportWithDarkMode),
    );
    svgRoot.appendChild(rect);
  }

  // ---------------------------------------------------------------------------
  // render elements
  // ---------------------------------------------------------------------------

  const rsvg = rough.svg(svgRoot);

  const renderEmbeddables = config?.renderEmbeddables ?? false;

  // when exporting a frame, clip everything drawn to it (its clip path has
  // square corners), as the export may be larger than the frame
  let elementsRoot: SVGElement = svgRoot;
  if (cfg.exportingFrame) {
    elementsRoot = ownerDocument.createElementNS(SVG_NS, "g");
    elementsRoot.setAttribute("clip-path", `url(#${cfg.exportingFrame.id})`);
    svgRoot.appendChild(elementsRoot);
  }

  renderSceneToSvg(
    elementsForRender,
    toBrandedType<RenderableElementsMap>(arrayToMap(elementsForRender)),
    rsvg,
    elementsRoot,
    data.files || {},
    {
      offsetX,
      offsetY,
      isExporting: true,
      renderEnvironment,
      exportWithDarkMode,
      renderEmbeddables,
      frameRendering,
      canvasBackgroundColor: backgroundColor,
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

  const ownerDocument = metadataElement.ownerDocument;

  metadataElement.appendChild(
    createHTMLComment(ownerDocument, `payload-type:${MIME_TYPES.excalidraw}`),
  );
  metadataElement.appendChild(
    createHTMLComment(ownerDocument, "payload-version:2"),
  );
  metadataElement.appendChild(
    createHTMLComment(ownerDocument, "payload-start"),
  );
  metadataElement.appendChild(ownerDocument.createTextNode(base64));
  metadataElement.appendChild(createHTMLComment(ownerDocument, "payload-end"));
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
const getCanvasSize = (
  elements: readonly NonDeletedExcalidrawElement[],
): [x: number, y: number, width: number, height: number] => {
  const [minX, minY, maxX, maxY] = getCommonBounds(elements);
  const width = distance(minX, maxX);
  const height = distance(minY, maxY);

  return [minX, minY, width, height];
};

// ---------------------------------------------------------------------------
// exportToBlob
// ---------------------------------------------------------------------------

export { MIME_TYPES };

type ExportToPngConfig = ExportSceneConfig & {
  /**
   * Embeds the scene into the PNG metadata, so that it can be imported back
   * into Excalidraw.
   */
  embedScene?: boolean;
};

type ExportToJpegConfig = ExportSceneConfig & {
  /**
   * Encoding quality between 0 and 1.
   *
   * @default 0.92
   */
  quality?: number;
};

const exportToBlob = async (
  opts: { data: ExportSceneData } & (
    | { type: "png"; config?: ExportToPngConfig }
    | { type: "jpeg"; config?: ExportToJpegConfig }
  ),
): Promise<Blob> => {
  const { data } = opts;
  let config: ExportSceneConfig | undefined = opts.config;

  // JPEG has no alpha channel (transparent pixels would turn black)
  if (opts.type === "jpeg" && config?.canvasBackgroundColor === false) {
    console.warn(
      `"canvasBackgroundColor: false" is not supported for JPEG, using the default background`,
    );
    config = { ...config, canvasBackgroundColor: undefined };
  }

  const canvas = await exportToCanvas({ data, config });

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      async (blob) => {
        if (!blob) {
          return reject(new Error("couldn't export to blob"));
        }
        if (opts.type === "png" && opts.config?.embedScene) {
          blob = await encodePngMetadata({
            blob,
            metadata: serializeAsJSON(
              // NOTE as long as we're using the Scene hack, we need to ensure
              // we pass the original, uncloned elements when serializing
              // so that we keep ids stable (restoring keeps the ids)
              restoreElements(data.elements, null),
              data.appState ?? {},
              data.files || {},
              "local",
            ),
          });
        }
        resolve(blob);
      },
      opts.type === "png" ? MIME_TYPES.png : MIME_TYPES.jpg,
      opts.type === "jpeg" ? opts.config?.quality || 0.92 : undefined,
    );
  });
};

// ---------------------------------------------------------------------------
// exportScene
// ---------------------------------------------------------------------------

export type ExportSceneOptions = { data: ExportSceneData } & (
  | { type: "canvas"; config?: ExportSceneConfig }
  | { type: "png"; config?: ExportToPngConfig }
  | { type: "jpeg"; config?: ExportToJpegConfig }
  | { type: "svg"; config?: ExportToSvgConfig }
);

/**
 * Exports the scene to a canvas, a PNG or JPEG blob, or an SVG element.
 */
export function exportScene(
  opts: Extract<ExportSceneOptions, { type: "canvas" }>,
): Promise<HTMLCanvasElement>;
export function exportScene(
  opts: Extract<ExportSceneOptions, { type: "png" | "jpeg" }>,
): Promise<Blob>;
export function exportScene(
  opts: Extract<ExportSceneOptions, { type: "svg" }>,
): Promise<SVGSVGElement>;
export function exportScene(
  opts: ExportSceneOptions,
): Promise<HTMLCanvasElement | Blob | SVGSVGElement>;
export function exportScene(
  opts: ExportSceneOptions,
): Promise<HTMLCanvasElement | Blob | SVGSVGElement> {
  switch (opts.type) {
    case "canvas":
      return exportToCanvas(opts);
    case "png":
    case "jpeg":
      return exportToBlob(opts);
    case "svg":
      return exportToSvg(opts);
  }
}

// ---------------------------------------------------------------------------
// exportToClipboard
// ---------------------------------------------------------------------------

export const exportToClipboard = async (
  opts: { data: ExportSceneData } & (
    | { type: "png"; config?: ExportToPngConfig }
    | { type: "svg"; config?: ExportToSvgConfig }
    | { type: "json"; config?: never }
  ),
) => {
  if (opts.type === "svg") {
    const svg = await exportScene(opts);
    await copyTextToSystemClipboard(svg.outerHTML);
  } else if (opts.type === "png") {
    await copyBlobToClipboardAsPng(exportScene(opts));
  } else if (opts.type === "json") {
    await copyToClipboard(
      getNonDeletedElements(restoreElements(opts.data.elements, null)),
      opts.data.files ?? null,
    );
  } else {
    throw new Error("Invalid export type");
  }
};

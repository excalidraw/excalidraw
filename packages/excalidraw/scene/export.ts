import rough from "roughjs/bin/rough";
import type {
  ExcalidrawElement,
  ExcalidrawFrameLikeElement,
  ExcalidrawTextElement,
  NonDeletedExcalidrawElement,
  NonDeletedSceneElementsMap,
} from "../element/types";
import type { Bounds } from "../element/bounds";
import { getCommonBounds, getElementAbsoluteCoords } from "../element/bounds";
import { renderSceneToSvg } from "../renderer/staticSvgScene";
import {
  arrayToMap,
  distance,
  getFontString,
  PromisePool,
  promiseTry,
  toBrandedType,
} from "../utils";
import type { AppState, BinaryFiles } from "../types";
import {
  DEFAULT_EXPORT_PADDING,
  FRAME_STYLE,
  FONT_FAMILY,
  SVG_NS,
  THEME,
  THEME_FILTER,
  FONT_FAMILY_FALLBACKS,
  getFontFamilyFallbacks,
  CJK_HAND_DRAWN_FALLBACK_FONT,
} from "../constants";
import { getDefaultAppState } from "../appState";
import { serializeAsJSON } from "../data/json";
import {
  getInitializedImageElements,
  updateImageCache,
} from "../element/image";
import {
  getElementsOverlappingFrame,
  getFrameLikeElements,
  getFrameLikeTitle,
  getRootElements,
} from "../frame";
import { newTextElement } from "../element";
import { type Mutable } from "../utility-types";
import { newElementWith } from "../element/mutateElement";
import { isFrameLikeElement, isTextElement } from "../element/typeChecks";
import type { RenderableElementsMap } from "./types";
import { syncInvalidIndices } from "../fractionalIndex";
import { renderStaticScene } from "../renderer/staticScene";
import { Fonts } from "../fonts";
import { containsCJK } from "../element/textElement";

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
  loadFonts: () => Promise<void> = async () => {
    await Fonts.loadElementsFonts(elements);
  },
) => {
  // load font faces before continuing, by default leverages browsers' [FontFace API](https://developer.mozilla.org/en-US/docs/Web/API/FontFace)
  await loadFonts();

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
    elementsMap: toBrandedType<RenderableElementsMap>(
      arrayToMap(elementsForRender),
    ),
    allElementsMap: toBrandedType<NonDeletedSceneElementsMap>(
      arrayToMap(syncInvalidIndices(elements)),
    ),
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
      theme: appState.exportWithDarkMode ? THEME.DARK : THEME.LIGHT,
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
    frameRendering?: AppState["frameRendering"];
  },
  files: BinaryFiles | null,
  opts?: {
    /**
     * if true, all embeddables passed in will be rendered when possible.
     */
    renderEmbeddables?: boolean;
    exportingFrame?: ExcalidrawFrameLikeElement | null;
    skipInliningFonts?: true;
  },
): Promise<SVGSVGElement> => {
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
        await import("../data/image")
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

  const offsetX = -minX + exportPadding;
  const offsetY = -minY + exportPadding;

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
            exportingFrame
              ? ""
              : `rx=${FRAME_STYLE.radius} ry=${FRAME_STYLE.radius}`
          }
          >
          </rect>
        </clipPath>`;
  }

  const fontFaces = opts?.skipInliningFonts ? [] : await getFontFaces(elements);
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

  const renderEmbeddables = opts?.renderEmbeddables ?? false;

  renderSceneToSvg(
    elementsForRender,
    toBrandedType<RenderableElementsMap>(arrayToMap(elementsForRender)),
    rsvg,
    svgRoot,
    files || {},
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
    },
  );

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

const getFontFaces = async (
  elements: readonly ExcalidrawElement[],
): Promise<string[]> => {
  const fontFamilies = new Set<number>();
  const charsPerFamily: Record<number, Set<string>> = {};

  for (const element of elements) {
    if (!isTextElement(element)) {
      continue;
    }

    fontFamilies.add(element.fontFamily);

    // gather unique codepoints only when inlining fonts
    for (const char of element.originalText) {
      if (!charsPerFamily[element.fontFamily]) {
        charsPerFamily[element.fontFamily] = new Set();
      }

      charsPerFamily[element.fontFamily].add(char);
    }
  }

  const orderedFamilies = Array.from(fontFamilies);

  // for simplicity, assuming we have just one family with the CJK handdrawn fallback
  const familyWithCJK = orderedFamilies.find((x) =>
    getFontFamilyFallbacks(x).includes(CJK_HAND_DRAWN_FALLBACK_FONT),
  );

  if (familyWithCJK) {
    const characters = getChars(charsPerFamily[familyWithCJK]);

    if (containsCJK(characters)) {
      const family = FONT_FAMILY_FALLBACKS[CJK_HAND_DRAWN_FALLBACK_FONT];

      // adding the same characters to the CJK handrawn family
      charsPerFamily[family] = new Set(characters);

      // the order between the families and fallbacks is important, as fallbacks need to be defined first and in the reversed order
      // so that they get overriden with the later defined font faces, i.e. in case they share some codepoints
      orderedFamilies.unshift(
        FONT_FAMILY_FALLBACKS[CJK_HAND_DRAWN_FALLBACK_FONT],
      );
    }
  }

  const iterator = fontFacesIterator(orderedFamilies, charsPerFamily);

  // don't trigger hundreds of concurrent requests (each performing fetch, creating a worker, etc.),
  // instead go three requests at a time, in a controlled manner, without completely blocking the main thread
  // and avoiding potential issues such as rate limits
  const concurrency = 3;
  const fontFaces = await new PromisePool(iterator, concurrency).all();

  // dedup just in case (i.e. could be the same font faces with 0 glyphs)
  return Array.from(new Set(fontFaces));
};

function* fontFacesIterator(
  families: Array<number>,
  charsPerFamily: Record<number, Set<string>>,
): Generator<Promise<void | readonly [number, string]>> {
  for (const [familyIndex, family] of families.entries()) {
    const { fontFaces, metadata } = Fonts.registered.get(family) ?? {};

    if (!Array.isArray(fontFaces)) {
      console.error(
        `Couldn't find registered fonts for font-family "${family}"`,
        Fonts.registered,
      );
      continue;
    }

    if (metadata?.local) {
      // don't inline local fonts
      continue;
    }

    for (const [fontFaceIndex, fontFace] of fontFaces.entries()) {
      yield promiseTry(async () => {
        try {
          const characters = getChars(charsPerFamily[family]);
          const fontFaceCSS = await fontFace.toCSS(characters);

          if (!fontFaceCSS) {
            return;
          }

          // giving a buffer of 10K font faces per family
          const fontFaceOrder = familyIndex * 10_000 + fontFaceIndex;
          const fontFaceTuple = [fontFaceOrder, fontFaceCSS] as const;

          return fontFaceTuple;
        } catch (error) {
          console.error(
            `Couldn't transform font-face to css for family "${fontFace.fontFace.family}"`,
            error,
          );
        }
      });
    }
  }
}

const getChars = (characterSet: Set<string>) =>
  Array.from(characterSet).join("");

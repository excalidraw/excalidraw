import rough from "roughjs/bin/rough";
import { NonDeletedExcalidrawElement } from "../element/types";
import {
  Bounds,
  getCommonBounds,
  getElementAbsoluteCoords,
} from "../element/bounds";
import { renderSceneToSvg, renderStaticScene } from "../renderer/renderScene";
import {
  convertToExportPadding as convertExportPadding,
  distance,
  expandToAspectRatio,
  isOnlyExportingSingleFrame,
} from "../utils";
import { AppState, BinaryFiles, Dimensions, ExportPadding } from "../types";
import {
  DEFAULT_EXPORT_PADDING,
  FANCY_BACKGROUND_IMAGES,
  FANCY_BG_INCLUDE_LOGO,
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
import Scene from "./Scene";
import {
  applyFancyBackgroundOnCanvas,
  applyFancyBackgroundOnSvg,
  getFancyBackgroundPadding,
} from "./fancyBackground";

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
    exportPadding?: number | ExportPadding;
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
  const exportingWithFancyBackground = isExportingWithFacnyBackground(
    appState,
    elements,
  );

  const padding = !exportingWithFancyBackground
    ? convertExportPadding(exportPadding)
    : getFancyBackgroundPadding(
        convertExportPadding(exportPadding),
        FANCY_BG_INCLUDE_LOGO,
      );

  const onlyExportingSingleFrame = isOnlyExportingSingleFrame(elements);

  const [minX, minY, width, height] = !exportingWithFancyBackground
    ? getCanvasSize({
        elements,
        padding,
        onlyExportingSingleFrame,
        exportingWithFancyBackground,
        opts: {
          clipFrame: appState.frameRendering.clip,
        },
      })
    : getCanvasSize({
        elements,
        padding,
        onlyExportingSingleFrame,
        exportingWithFancyBackground,
        opts: {
          aspectRatio: { width: 16, height: 9 },
          clipFrame: appState.frameRendering.clip,
        },
      });

  const { canvas, scale = 1 } = createCanvas(width, height);

  const defaultAppState = getDefaultAppState();

  const { imageCache } = await updateImageCache({
    imageCache: new Map(),
    fileIds: getInitializedImageElements(elements).map(
      (element) => element.fileId,
    ),
    files,
  });

  let scrollXAdjustment = 0;
  let scrollYAdjustment = 0;

  if (
    exportingWithFancyBackground &&
    appState.fancyBackgroundImageKey !== "solid"
  ) {
    const commonBounds = getElementsSize({
      elements,
      onlyExportingSingleFrame,
      clipFrame: appState.frameRendering.clip,
    });
    const contentSize: Dimensions = {
      width: distance(commonBounds[0], commonBounds[2]),
      height: distance(commonBounds[1], commonBounds[3]),
    };

    await applyFancyBackgroundOnCanvas({
      canvas,
      fancyBackgroundImageKey: appState.fancyBackgroundImageKey,
      backgroundColor: viewBackgroundColor,
      exportScale: scale,
      theme: appState.exportWithDarkMode ? THEME.DARK : THEME.LIGHT,
      contentSize,
      includeLogo: FANCY_BG_INCLUDE_LOGO,
    });

    scrollXAdjustment =
      (width - contentSize.width - (padding[1] + padding[3])) / 2;

    scrollYAdjustment =
      (height - contentSize.height - (padding[0] + padding[2])) / 2;
  }

  renderStaticScene({
    canvas,
    rc: rough.canvas(canvas),
    elements,
    visibleElements: elements,
    scale,
    appState: {
      ...appState,
      viewBackgroundColor:
        exportBackground && !exportingWithFancyBackground
          ? viewBackgroundColor
          : null,
      scrollX:
        -minX +
        (onlyExportingSingleFrame && !exportingWithFancyBackground
          ? 0
          : padding[3] + scrollXAdjustment),
      scrollY:
        -minY +
        (onlyExportingSingleFrame && !exportingWithFancyBackground
          ? 0
          : padding[0] + scrollYAdjustment),
      zoom: defaultAppState.zoom,
      shouldCacheIgnoreZoom: false,
      theme: appState.exportWithDarkMode ? THEME.DARK : THEME.LIGHT,
    },
    renderConfig: {
      imageCache,
      renderGrid: false,
      isExporting: true,
      exportWithFancyBackground: exportingWithFancyBackground,
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
    renderFrame?: boolean;
    fancyBackgroundImageKey?: keyof typeof FANCY_BACKGROUND_IMAGES;
    clipFrame?: boolean;
  },
  files: BinaryFiles | null,
  opts?: {
    serializeAsJSON?: () => string;
    renderEmbeddables?: boolean;
  },
): Promise<SVGSVGElement> => {
  const {
    exportPadding = DEFAULT_EXPORT_PADDING,
    viewBackgroundColor,
    exportScale = 1,
    exportEmbedScene,
  } = appState;

  const exportingWithFancyBackground = isExportingWithFacnyBackground(
    {
      exportBackground: appState.exportBackground,
      fancyBackgroundImageKey: appState.fancyBackgroundImageKey,
    },
    elements,
  );

  const padding = !exportingWithFancyBackground
    ? convertExportPadding(exportPadding)
    : getFancyBackgroundPadding(
        convertExportPadding(exportPadding),
        FANCY_BG_INCLUDE_LOGO,
      );

  let metadata = "";
  if (exportEmbedScene) {
    try {
      metadata = await (
        await import(/* webpackChunkName: "image" */ "../../src/data/image")
      ).encodeSvgMetadata({
        text: opts?.serializeAsJSON
          ? opts?.serializeAsJSON?.()
          : serializeAsJSON(elements, appState, files || {}, "local"),
      });
    } catch (error: any) {
      console.error(error);
    }
  }

  const onlyExportingSingleFrame = isOnlyExportingSingleFrame(elements);

  const [minX, minY, width, height] = !exportingWithFancyBackground
    ? getCanvasSize({
        elements,
        padding,
        onlyExportingSingleFrame,
        exportingWithFancyBackground,
        opts: {
          clipFrame: appState.clipFrame ?? false,
        },
      })
    : getCanvasSize({
        elements,
        padding,
        onlyExportingSingleFrame,
        exportingWithFancyBackground,
        opts: {
          aspectRatio: { width: 16, height: 9 },
          clipFrame: appState.clipFrame ?? false,
        },
      });

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

  // do not apply clipping when we're exporting the whole scene
  const isExportingWholeCanvas =
    Scene.getScene(elements[0])?.getNonDeletedElements()?.length ===
    elements.length;

  const offsetX =
    -minX +
    (onlyExportingSingleFrame && !exportingWithFancyBackground
      ? 0
      : padding[3]);
  const offsetY =
    -minY +
    (onlyExportingSingleFrame && !exportingWithFancyBackground
      ? 0
      : padding[0]);

  const exportingFrame =
    isExportingWholeCanvas || !onlyExportingSingleFrame
      ? undefined
      : elements.find((element) => element.type === "frame");

  let exportingFrameClipPath = "";
  if (exportingFrame && appState.clipFrame) {
    const [x1, y1, x2, y2] = getElementAbsoluteCoords(exportingFrame);
    const cx = (x2 - x1) / 2 - (exportingFrame.x - x1);
    const cy = (y2 - y1) / 2 - (exportingFrame.y - y1);

    exportingFrameClipPath = `<clipPath id=${exportingFrame.id}>
            <rect transform="translate(${exportingFrame.x + offsetX} ${
      exportingFrame.y + offsetY
    }) rotate(${exportingFrame.angle} ${cx} ${cy})"
          width="${exportingFrame.width}"
          height="${exportingFrame.height}"
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
    </style>
    ${exportingFrameClipPath}
  </defs>
  `;

  let offsetXAdjustment = 0;
  let offsetYAdjustment = 0;

  // render background rect
  if (appState.exportBackground && viewBackgroundColor) {
    if (
      exportingWithFancyBackground &&
      appState.fancyBackgroundImageKey &&
      appState.fancyBackgroundImageKey !== "solid"
    ) {
      const commonBounds = getElementsSize({
        elements,
        onlyExportingSingleFrame,
        clipFrame: appState.clipFrame ?? false,
      });
      const contentSize: Dimensions = {
        width: distance(commonBounds[0], commonBounds[2]),
        height: distance(commonBounds[1], commonBounds[3]),
      };
      await applyFancyBackgroundOnSvg({
        svgRoot,
        fancyBackgroundImageKey: `${appState.fancyBackgroundImageKey}`,
        backgroundColor: viewBackgroundColor,
        canvasDimensions: {
          width,
          height,
        },
        theme: appState.exportWithDarkMode ? THEME.DARK : THEME.LIGHT,
        contentSize,
        includeLogo: FANCY_BG_INCLUDE_LOGO,
      });

      offsetXAdjustment =
        (width - contentSize.width - (padding[1] + padding[3])) / 2;
      offsetYAdjustment =
        (height - contentSize.height - (padding[0] + padding[2])) / 2;
    } else {
      const rect = svgRoot.ownerDocument!.createElementNS(SVG_NS, "rect");
      rect.setAttribute("x", "0");
      rect.setAttribute("y", "0");
      rect.setAttribute("width", `${width}`);
      rect.setAttribute("height", `${height}`);
      rect.setAttribute("fill", viewBackgroundColor);
      svgRoot.appendChild(rect);
    }
  }

  const rsvg = rough.svg(svgRoot);
  renderSceneToSvg(elements, rsvg, svgRoot, files || {}, {
    offsetX: offsetX + offsetXAdjustment,
    offsetY: offsetY + offsetYAdjustment,
    exportWithDarkMode: appState.exportWithDarkMode,
    exportingFrameId: exportingFrame?.id || null,
    renderEmbeddables: opts?.renderEmbeddables,
  });

  return svgRoot;
};

const getElementsSize = ({
  elements,
  onlyExportingSingleFrame,
  clipFrame,
}: {
  elements: readonly NonDeletedExcalidrawElement[];
  onlyExportingSingleFrame: boolean;
  clipFrame: boolean;
}): Bounds => {
  // we should decide if we are exporting the whole canvas
  // if so, we are not clipping elements in the frame
  // and therefore, we should not do anything special
  const isExportingWholeCanvas =
    Scene.getScene(elements[0])?.getNonDeletedElements()?.length ===
    elements.length;

  if ((!isExportingWholeCanvas || onlyExportingSingleFrame) && clipFrame) {
    const frames = elements.filter((element) => element.type === "frame");

    const exportedFrameIds = frames.reduce((acc, frame) => {
      acc[frame.id] = true;
      return acc;
    }, {} as Record<string, true>);

    // elements in a frame do not affect the canvas size if we're not exporting
    // the whole canvas
    elements = elements.filter(
      (element) => !exportedFrameIds[element.frameId ?? ""],
    );
  }

  return getCommonBounds(elements);
};

// calculate smallest area to fit the contents in
const getCanvasSize = ({
  elements,
  padding,
  onlyExportingSingleFrame,
  exportingWithFancyBackground,
  opts,
}: {
  elements: readonly NonDeletedExcalidrawElement[];
  padding: ExportPadding;
  onlyExportingSingleFrame: boolean;
  exportingWithFancyBackground: boolean;
  opts?: { aspectRatio?: Dimensions; clipFrame?: boolean };
}): [number, number, number, number] => {
  const [minX, minY, maxX, maxY] = getElementsSize({
    elements,
    onlyExportingSingleFrame,
    clipFrame: opts?.clipFrame ?? false,
  });

  let width = 0;
  let height = 0;

  if (onlyExportingSingleFrame && !exportingWithFancyBackground) {
    width = distance(minX, maxX);
    height = distance(minY, maxY);
  } else {
    width = distance(minX, maxX) + padding[1] + padding[3];
    height = distance(minY, maxY) + padding[0] + padding[2];
  }

  if (opts?.aspectRatio) {
    const expandedDimensions = expandToAspectRatio(
      { width, height },
      opts.aspectRatio,
    );

    return [minX, minY, expandedDimensions.width, expandedDimensions.height];
  }

  return [minX, minY, width, height];
};

export const getExportSize = (
  elements: readonly NonDeletedExcalidrawElement[],
  exportPadding: number,
  scale: number,
  appState: AppState,
): [number, number] => {
  const [, , width, height] = getCanvasSize({
    elements,
    padding: convertExportPadding(exportPadding),
    onlyExportingSingleFrame: isOnlyExportingSingleFrame(elements),
    exportingWithFancyBackground: isExportingWithFacnyBackground(
      appState,
      elements,
    ),
    opts: {
      clipFrame: appState.frameRendering.clip,
    },
  }).map((dimension) => Math.trunc(dimension * scale));

  return [width, height];
};

const isExportingWithFacnyBackground = (
  appState: Partial<
    Pick<AppState, "exportBackground" | "fancyBackgroundImageKey">
  >,
  elements: readonly NonDeletedExcalidrawElement[],
): boolean => {
  return Boolean(
    appState.exportBackground &&
      appState.fancyBackgroundImageKey &&
      appState.fancyBackgroundImageKey !== "solid" &&
      elements.length > 0,
  );
};

import rough from "roughjs/bin/rough";
import { NonDeletedExcalidrawElement } from "../element/types";
import { getCommonBounds, getElementAbsoluteCoords } from "../element/bounds";
import { renderSceneToSvg, renderStaticScene } from "../renderer/renderScene";
import {
  convertToExportPadding,
  distance,
  expandToAspectRatio,
  isOnlyExportingSingleFrame,
} from "../utils";
import { AppState, BinaryFiles, Dimensions, ExportPadding } from "../types";
import {
  DEFAULT_EXPORT_PADDING,
  FANCY_BACKGROUND_IMAGES,
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
    exportLogo = true,
    viewBackgroundColor,
  }: {
    exportBackground: boolean;
    exportPadding?: number | ExportPadding;
    exportLogo?: boolean;
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
  const exportWithFancyBackground =
    exportBackground &&
    appState.fancyBackgroundImageKey &&
    appState.fancyBackgroundImageKey !== "solid" &&
    elements.length > 0;

  const padding = !exportWithFancyBackground
    ? convertToExportPadding(exportPadding)
    : getFancyBackgroundPadding(
        convertToExportPadding(exportPadding),
        exportLogo,
      );

  const [minX, minY, width, height] = !exportWithFancyBackground
    ? getCanvasSize(elements, padding)
    : getCanvasSize(elements, padding, {
        aspectRatio: { width: 16, height: 9 },
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

  const onlyExportingSingleFrame = isOnlyExportingSingleFrame(elements);

  let scrollXAdjustment = 0;
  let scrollYAdjustment = 0;

  if (
    exportWithFancyBackground &&
    appState.fancyBackgroundImageKey !== "solid"
  ) {
    const commonBounds = getCommonBounds(elements);
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
      includeLogo: exportLogo,
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
        exportBackground && !exportWithFancyBackground
          ? viewBackgroundColor
          : null,
      scrollX:
        -minX + (onlyExportingSingleFrame ? 0 : padding[3] + scrollXAdjustment),
      scrollY:
        -minY + (onlyExportingSingleFrame ? 0 : padding[0] + scrollYAdjustment),
      zoom: defaultAppState.zoom,
      shouldCacheIgnoreZoom: false,
      theme: appState.exportWithDarkMode ? THEME.DARK : THEME.LIGHT,
    },
    renderConfig: {
      imageCache,
      renderGrid: false,
      isExporting: true,
      exportWithFancyBackground,
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
  },
  files: BinaryFiles | null,
  opts?: {
    serializeAsJSON?: () => string;
    renderEmbeddables?: boolean;
    includeLogo?: boolean;
  },
): Promise<SVGSVGElement> => {
  const {
    exportPadding = DEFAULT_EXPORT_PADDING,
    viewBackgroundColor,
    exportScale = 1,
    exportEmbedScene,
    exportBackground,
  } = appState;

  const exportWithFancyBackground =
    exportBackground &&
    elements.length > 0 &&
    appState.fancyBackgroundImageKey &&
    appState.fancyBackgroundImageKey !== "solid";

  const includeLogo = (exportWithFancyBackground && opts?.includeLogo) ?? true;

  const padding = !exportWithFancyBackground
    ? convertToExportPadding(exportPadding)
    : getFancyBackgroundPadding(
        convertToExportPadding(exportPadding),
        includeLogo,
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
  const [minX, minY, width, height] = !exportWithFancyBackground
    ? getCanvasSize(elements, padding)
    : getCanvasSize(elements, padding, {
        aspectRatio: { width: 16, height: 9 },
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

  const onlyExportingSingleFrame = isOnlyExportingSingleFrame(elements);

  const offsetX = -minX + (onlyExportingSingleFrame ? 0 : padding[3]);
  const offsetY = -minY + (onlyExportingSingleFrame ? 0 : padding[0]);

  const exportingFrame =
    isExportingWholeCanvas || !onlyExportingSingleFrame
      ? undefined
      : elements.find((element) => element.type === "frame");

  let exportingFrameClipPath = "";
  if (exportingFrame) {
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
      appState.fancyBackgroundImageKey &&
      appState.fancyBackgroundImageKey !== "solid"
    ) {
      const commonBounds = getCommonBounds(elements);
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
        includeLogo,
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

// calculate smallest area to fit the contents in
const getCanvasSize = (
  elements: readonly NonDeletedExcalidrawElement[],
  exportPadding: ExportPadding,
  opts?: { aspectRatio: Dimensions },
): [number, number, number, number] => {
  // we should decide if we are exporting the whole canvas
  // if so, we are not clipping elements in the frame
  // and therefore, we should not do anything special

  const isExportingWholeCanvas =
    Scene.getScene(elements[0])?.getNonDeletedElements()?.length ===
    elements.length;

  const onlyExportingSingleFrame = isOnlyExportingSingleFrame(elements);

  if (!isExportingWholeCanvas || onlyExportingSingleFrame) {
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

  const [minX, minY, maxX, maxY] = getCommonBounds(elements);

  let width = 0;
  let height = 0;

  if (onlyExportingSingleFrame) {
    width = distance(minX, maxX);
    height = distance(minY, maxY);
  } else {
    width = distance(minX, maxX) + exportPadding[1] + exportPadding[3];
    height = distance(minY, maxY) + exportPadding[0] + exportPadding[2];
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
): [number, number] => {
  const [, , width, height] = getCanvasSize(
    elements,
    convertToExportPadding(exportPadding),
  ).map((dimension) => Math.trunc(dimension * scale));

  return [width, height];
};

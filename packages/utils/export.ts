import {
  exportToCanvas as _exportToCanvas,
  type ExportToCanvasConfig,
  type ExportToCanvasData,
  exportToSvg as _exportToSvg,
} from "../excalidraw/scene/export";
import { restore } from "../excalidraw/data/restore";
import { COLOR_WHITE, MIME_TYPES } from "../excalidraw/constants";
import { encodePngMetadata } from "../excalidraw/data/image";
import { serializeAsJSON } from "../excalidraw/data/json";
import {
  copyBlobToClipboardAsPng,
  copyTextToSystemClipboard,
  copyToClipboard,
} from "../excalidraw/clipboard";
import { getNonDeletedElements } from "../excalidraw";

export { MIME_TYPES };

type ExportToBlobConfig = ExportToCanvasConfig & {
  mimeType?: string;
  quality?: number;
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

export const exportToCanvas = async ({
  data,
  config,
}: {
  data: ExportToCanvasData;
  config?: ExportToCanvasConfig;
}) => {
  return _exportToCanvas({
    data,
    config,
  });
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

  const canvas = await _exportToCanvas({ data, config });

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

export const exportToSvg = async ({
  data,
  config,
}: {
  data: ExportToCanvasData;
  config?: ExportToSvgConfig;
}): Promise<SVGSVGElement> => {
  const { elements: restoredElements, appState: restoredAppState } = restore(
    { ...data, files: data.files || {} },
    null,
    null,
  );

  const appState = { ...restoredAppState, exportPadding: config?.padding };
  const elements = getNonDeletedElements(restoredElements);
  const files = data.files || {};

  return _exportToSvg({
    data: { elements, appState, files },
    config: {
      exportingFrame: config?.exportingFrame,
      renderEmbeddables: config?.renderEmbeddables,
      skipInliningFonts: config?.skipInliningFonts,
      reuseImages: config?.reuseImages,
    },
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
    const svg = await exportToSvg({ data, config });
    await copyTextToSystemClipboard(svg.outerHTML);
  } else if (type === "png") {
    await copyBlobToClipboardAsPng(exportToBlob({ data, config }));
  } else if (type === "json") {
    await copyToClipboard(data.elements, data.files);
  } else {
    throw new Error("Invalid export type");
  }
};

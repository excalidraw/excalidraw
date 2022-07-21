import {
  exportToCanvas as _exportToCanvas,
  exportToSvg as _exportToSvg,
} from "../scene/export";
import { getDefaultAppState } from "../appState";
import { AppState, BinaryFiles } from "../types";
import { ExcalidrawElement, NonDeleted } from "../element/types";
import { getNonDeletedElements } from "../element";
import { restore } from "../data/restore";
import { MIME_TYPES } from "../constants";
import { encodePngMetadata } from "../data/image";
import { serializeAsJSON } from "../data/json";
import {
  copyBlobToClipboardAsPng,
  copyTextToSystemClipboard,
  copyToClipboard,
} from "../clipboard";

export { MIME_TYPES };

type ExportOpts = {
  elements: readonly NonDeleted<ExcalidrawElement>[];
  appState?: Partial<Omit<AppState, "offsetTop" | "offsetLeft">>;
  files: BinaryFiles | null;
  maxWidthOrHeight?: number;
  getDimensions?: (
    width: number,
    height: number,
  ) => { width: number; height: number; scale?: number };
};

export const exportToCanvas = ({
  elements,
  appState,
  files,
  maxWidthOrHeight,
  getDimensions,
}: ExportOpts) => {
  const { elements: restoredElements, appState: restoredAppState } = restore(
    { elements, appState },
    null,
    null,
  );
  const { exportBackground, viewBackgroundColor } = restoredAppState;
  return _exportToCanvas(
    getNonDeletedElements(restoredElements),
    { ...restoredAppState, offsetTop: 0, offsetLeft: 0, width: 0, height: 0 },
    files || {},
    { exportBackground, viewBackgroundColor },
    (width: number, height: number) => {
      const canvas = document.createElement("canvas");

      if (maxWidthOrHeight) {
        if (typeof getDimensions === "function") {
          console.warn(
            "`getDimensions()` is ignored when `maxWidthOrHeight` is supplied.",
          );
        }

        const max = Math.max(width, height);

        const scale = maxWidthOrHeight / max;

        canvas.width = width * scale;
        canvas.height = height * scale;

        return {
          canvas,
          scale,
        };
      }

      const ret = getDimensions?.(width, height) || { width, height };

      canvas.width = ret.width;
      canvas.height = ret.height;

      return {
        canvas,
        scale: ret.scale ?? 1,
      };
    },
  );
};

export const exportToBlob = async (
  opts: ExportOpts & {
    mimeType?: string;
    quality?: number;
  },
): Promise<Blob> => {
  let { mimeType = MIME_TYPES.png, quality } = opts;

  if (mimeType === MIME_TYPES.png && typeof quality === "number") {
    console.warn(`"quality" will be ignored for "${MIME_TYPES.png}" mimeType`);
  }

  // typo in MIME type (should be "jpeg")
  if (mimeType === "image/jpg") {
    mimeType = MIME_TYPES.jpg;
  }

  if (mimeType === MIME_TYPES.jpg && !opts.appState?.exportBackground) {
    console.warn(
      `Defaulting "exportBackground" to "true" for "${MIME_TYPES.jpg}" mimeType`,
    );
    opts = {
      ...opts,
      appState: { ...opts.appState, exportBackground: true },
    };
  }

  const canvas = await exportToCanvas(opts);

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
          opts.appState?.exportEmbedScene
        ) {
          blob = await encodePngMetadata({
            blob,
            metadata: serializeAsJSON(
              opts.elements,
              opts.appState,
              opts.files || {},
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
  elements,
  appState = getDefaultAppState(),
  files = {},
  exportPadding,
}: Omit<ExportOpts, "getDimensions"> & {
  exportPadding?: number;
}): Promise<SVGSVGElement> => {
  const { elements: restoredElements, appState: restoredAppState } = restore(
    { elements, appState },
    null,
    null,
  );
  return _exportToSvg(
    getNonDeletedElements(restoredElements),
    {
      ...restoredAppState,
      exportPadding,
    },
    files,
  );
};

export const exportToClipboard = async (
  opts: ExportOpts & {
    mimeType?: string;
    quality?: number;
    type: "png" | "svg" | "json";
  },
) => {
  if (opts.type === "svg") {
    const svg = await exportToSvg(opts);
    await copyTextToSystemClipboard(svg.outerHTML);
  } else if (opts.type === "png") {
    await copyBlobToClipboardAsPng(exportToBlob(opts));
  } else if (opts.type === "json") {
    const appState = {
      offsetTop: 0,
      offsetLeft: 0,
      width: 0,
      height: 0,
      ...getDefaultAppState(),
      ...opts.appState,
    };
    await copyToClipboard(opts.elements, appState, opts.files);
  } else {
    throw new Error("Invalid export type");
  }
};

export { decompressData, compressData } from "../data/encode";
export { generateEncryptionKey } from "../data/encryption";
export { serializeAsJSON, serializeLibraryAsJSON } from "../data/json";
export {
  loadFromBlob,
  loadSceneOrLibraryFromBlob,
  loadLibraryFromBlob,
} from "../data/blob";
export { getFreeDrawSvgPath } from "../renderer/renderElement";
export { mergeLibraryItems } from "../data/library";

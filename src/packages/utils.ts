import {
  exportToCanvas as _exportToCanvas,
  exportToSvg as _exportToSvg,
} from "../scene/export";
import { getDefaultAppState } from "../appState";
import { AppState } from "../types";
import { ExcalidrawElement } from "../element/types";
import { getNonDeletedElements } from "../element";
import { restore } from "../data/restore";

type ExportOpts = {
  elements: readonly ExcalidrawElement[];
  appState?: Partial<Omit<AppState, "offsetTop" | "offsetLeft">>;
  getDimensions: (
    width: number,
    height: number,
  ) => { width: number; height: number; scale: number };
};

export const exportToCanvas = ({
  elements,
  appState,
  getDimensions = (width, height) => ({ width, height, scale: 1 }),
}: ExportOpts) => {
  const { elements: restoredElements, appState: restoredAppState } = restore(
    { elements, appState },
    null,
  );
  const {
    exportBackground,
    viewBackgroundColor,
    shouldAddWatermark,
  } = restoredAppState;
  return _exportToCanvas(
    getNonDeletedElements(restoredElements),
    { ...restoredAppState, offsetTop: 0, offsetLeft: 0 },
    { exportBackground, viewBackgroundColor, shouldAddWatermark },
    (width: number, height: number) => {
      const canvas = document.createElement("canvas");
      const ret = getDimensions(width, height);

      canvas.width = ret.width;
      canvas.height = ret.height;

      return { canvas, scale: ret.scale };
    },
  );
};

export const exportToBlob = (
  opts: ExportOpts & {
    mimeType?: string;
    quality?: number;
  },
): Promise<Blob | null> => {
  const canvas = exportToCanvas(opts);

  let { mimeType = "image/png", quality } = opts;

  if (mimeType === "image/png" && typeof quality === "number") {
    console.warn(`"quality" will be ignored for "image/png" mimeType`);
  }

  if (mimeType === "image/jpg") {
    mimeType = "image/jpeg";
  }

  quality = quality ? quality : /image\/jpe?g/.test(mimeType) ? 0.92 : 0.8;

  return new Promise((resolve) => {
    canvas.toBlob(
      (blob: Blob | null) => {
        resolve(blob);
      },
      mimeType,
      quality,
    );
  });
};

export const exportToSvg = ({
  elements,
  appState = getDefaultAppState(),
  exportPadding,
  metadata,
}: ExportOpts & {
  exportPadding?: number;
  metadata?: string;
}): SVGSVGElement => {
  const { elements: restoredElements, appState: restoredAppState } = restore(
    { elements, appState },
    null,
  );
  return _exportToSvg(getNonDeletedElements(restoredElements), {
    ...restoredAppState,
    exportPadding,
    metadata,
  });
};

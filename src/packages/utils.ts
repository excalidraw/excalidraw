import {
  exportToCanvas as _exportToCanvas,
  exportToSvg as _exportToSvg,
} from "../scene/export";
import { getDefaultAppState } from "../appState";
import { AppState } from "../types";
import { ExcalidrawElement } from "../element/types";
import { getNonDeletedElements } from "../element";

type ExportOpts = {
  elements: readonly ExcalidrawElement[];
  appState?: Omit<AppState, "offsetTop" | "offsetLeft">;
  getDimensions: (
    width: number,
    height: number,
  ) => { width: number; height: number; scale: number };
};

export const exportToCanvas = ({
  elements,
  appState = getDefaultAppState(),
  getDimensions = (width, height) => ({ width, height, scale: 1 }),
}: ExportOpts) => {
  return _exportToCanvas(
    getNonDeletedElements(elements),
    { ...appState, offsetTop: 0, offsetLeft: 0 },
    {
      exportBackground: appState.exportBackground ?? true,
      viewBackgroundColor: appState.viewBackgroundColor ?? "#FFF",
      shouldAddWatermark: appState.shouldAddWatermark ?? false,
    },
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
  return _exportToSvg(getNonDeletedElements(elements), {
    ...appState,
    exportPadding,
    metadata,
  });
};

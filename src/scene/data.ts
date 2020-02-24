import { ExcalidrawElement } from "../element/types";

import {
  getDefaultAppState,
  cleanAppStateForExport,
  clearAppStateForLocalStorage,
} from "../appState";

import { AppState, FlooredNumber } from "../types";
import { ExportType } from "./types";
import { exportToCanvas, exportToSvg } from "./export";
import nanoid from "nanoid";
import { fileOpen, fileSave } from "browser-nativefs";
import {
  getCommonBounds,
  normalizeDimensions,
  isInvisiblySmallElement,
} from "../element";

import { Point } from "roughjs/bin/geometry";
import { t } from "../i18n";
import { copyCanvasToClipboardAsPng } from "../clipboard";

const LOCAL_STORAGE_KEY = "excalidraw";
const LOCAL_STORAGE_KEY_STATE = "excalidraw-state";

// TODO: Defined globally, since file handles aren't yet serializable.
// Once `FileSystemFileHandle` can be serialized, make this
// part of `AppState`.
(window as any).handle = null;

interface DataState {
  type?: string;
  version?: string;
  source?: string;
  elements: readonly ExcalidrawElement[];
  appState: AppState | null;
  selectedId?: number;
}

export function serializeAsJSON(
  elements: readonly ExcalidrawElement[],
  appState: AppState,
): string {
  return JSON.stringify(
    {
      type: "excalidraw",
      version: 1,
      source: window.location.origin,
      elements: elements.map(({ shape, canvas, isSelected, ...el }) => el),
      appState: cleanAppStateForExport(appState),
    },
    null,
    2,
  );
}

export function normalizeScroll(pos: number) {
  return Math.floor(pos) as FlooredNumber;
}

export function calculateScrollCenter(
  elements: readonly ExcalidrawElement[],
): { scrollX: FlooredNumber; scrollY: FlooredNumber } {
  const [x1, y1, x2, y2] = getCommonBounds(elements);

  const centerX = (x1 + x2) / 2;
  const centerY = (y1 + y2) / 2;

  return {
    scrollX: normalizeScroll(window.innerWidth / 2 - centerX),
    scrollY: normalizeScroll(window.innerHeight / 2 - centerY),
  };
}

export async function saveAsJSON(
  elements: readonly ExcalidrawElement[],
  appState: AppState,
) {
  const serialized = serializeAsJSON(elements, appState);

  const name = `${appState.name}.json`;
  await fileSave(
    new Blob([serialized], { type: "application/json" }),
    {
      fileName: name,
      description: "Excalidraw file",
    },
    (window as any).handle,
  );
}
export async function loadFromJSON() {
  const blob = await fileOpen({
    description: "Excalidraw files",
    extensions: ["json"],
    mimeTypes: ["application/json"],
  });
  return loadFromBlob(blob);
}

export async function loadFromBlob(blob: any) {
  const updateAppState = (contents: string) => {
    const defaultAppState = getDefaultAppState();
    let elements = [];
    let appState = defaultAppState;
    try {
      const data = JSON.parse(contents);
      if (data.type !== "excalidraw") {
        throw new Error("Cannot load invalid json");
      }
      elements = data.elements || [];
      appState = { ...defaultAppState, ...data.appState };
    } catch (e) {
      // Do nothing because elements array is already empty
    }
    return { elements, appState };
  };

  if (blob.handle) {
    (window as any).handle = blob.handle;
  }
  let contents;
  if ("text" in Blob) {
    contents = await blob.text();
  } else {
    contents = await new Promise(resolve => {
      const reader = new FileReader();
      reader.readAsText(blob, "utf8");
      reader.onloadend = () => {
        if (reader.readyState === FileReader.DONE) {
          resolve(reader.result as string);
        }
      };
    });
  }
  const { elements, appState } = updateAppState(contents);
  if (!elements.length) {
    return Promise.reject("Cannot load invalid json");
  }
  return new Promise<DataState>(resolve => {
    resolve(restore(elements, appState, { scrollToContent: true }));
  });
}

export async function exportCanvas(
  type: ExportType,
  elements: readonly ExcalidrawElement[],
  canvas: HTMLCanvasElement,
  {
    exportBackground,
    exportPadding = 10,
    viewBackgroundColor,
    name,
    scale = 1,
  }: {
    exportBackground: boolean;
    exportPadding?: number;
    viewBackgroundColor: string;
    name: string;
    scale?: number;
  },
) {
  if (!elements.length) {
    return window.alert(t("alerts.cannotExportEmptyCanvas"));
  }
  // calculate smallest area to fit the contents in

  if (type === "svg") {
    const tempSvg = exportToSvg(elements, {
      exportBackground,
      viewBackgroundColor,
      exportPadding,
    });
    await fileSave(new Blob([tempSvg.outerHTML], { type: "image/svg+xml" }), {
      fileName: `${name}.svg`,
    });
    return;
  }

  const tempCanvas = exportToCanvas(elements, {
    exportBackground,
    viewBackgroundColor,
    exportPadding,
    scale,
  });
  tempCanvas.style.display = "none";
  document.body.appendChild(tempCanvas);

  if (type === "png") {
    const fileName = `${name}.png`;
    tempCanvas.toBlob(async (blob: any) => {
      if (blob) {
        await fileSave(blob, {
          fileName: fileName,
        });
      }
    });
  } else if (type === "clipboard") {
    try {
      copyCanvasToClipboardAsPng(tempCanvas);
    } catch (err) {
      window.alert(t("alerts.couldNotCopyToClipboard"));
    }
  }

  // clean up the DOM
  if (tempCanvas !== canvas) {
    tempCanvas.remove();
  }
}

function restore(
  savedElements: readonly ExcalidrawElement[],
  savedState: AppState | null,
  opts?: { scrollToContent: boolean },
): DataState {
  const elements = savedElements
    .filter(el => !isInvisiblySmallElement(el))
    .map(element => {
      let points: Point[] = [];
      if (element.type === "arrow") {
        if (Array.isArray(element.points)) {
          // if point array is empty, add one point to the arrow
          // this is used as fail safe to convert incoming data to a valid
          // arrow. In the new arrow, width and height are not being usde
          points = element.points.length > 0 ? element.points : [[0, 0]];
        } else {
          // convert old arrow type to a new one
          // old arrow spec used width and height
          // to determine the endpoints
          points = [
            [0, 0],
            [element.width, element.height],
          ];
        }
      } else if (element.type === "line") {
        // old spec, pre-arrows
        // old spec, post-arrows
        if (!Array.isArray(element.points) || element.points.length === 0) {
          points = [
            [0, 0],
            [element.width, element.height],
          ];
        } else {
          points = element.points;
        }
      } else {
        normalizeDimensions(element);
      }

      return {
        ...element,
        id: element.id || nanoid(),
        fillStyle: element.fillStyle || "hachure",
        strokeWidth: element.strokeWidth || 1,
        roughness: element.roughness || 1,
        opacity:
          element.opacity === null || element.opacity === undefined
            ? 100
            : element.opacity,
        points,
        shape: null,
        canvas: null,
        canvasOffsetX: element.canvasOffsetX || 0,
        canvasOffsetY: element.canvasOffsetY || 0,
      };
    });

  if (opts?.scrollToContent && savedState) {
    savedState = { ...savedState, ...calculateScrollCenter(elements) };
  }

  if (savedState) {
    savedState.zoom = savedState.zoom || getDefaultAppState().zoom;
  }

  return {
    elements: elements,
    appState: savedState,
  };
}

export function restoreFromLocalStorage() {
  const savedElements = localStorage.getItem(LOCAL_STORAGE_KEY);
  const savedState = localStorage.getItem(LOCAL_STORAGE_KEY_STATE);

  let elements = [];
  if (savedElements) {
    try {
      elements = JSON.parse(savedElements).map(
        ({ shape, ...element }: ExcalidrawElement) => element,
      );
    } catch (e) {
      // Do nothing because elements array is already empty
    }
  }

  let appState = null;
  if (savedState) {
    try {
      appState = JSON.parse(savedState) as AppState;
    } catch (e) {
      // Do nothing because appState is already null
    }
  }

  return restore(elements, appState);
}

export function saveToLocalStorage(
  elements: readonly ExcalidrawElement[],
  appState: AppState,
) {
  localStorage.setItem(
    LOCAL_STORAGE_KEY,
    JSON.stringify(
      elements.map(
        ({ shape, canvas, ...element }: ExcalidrawElement) => element,
      ),
    ),
  );
  localStorage.setItem(
    LOCAL_STORAGE_KEY_STATE,
    JSON.stringify(clearAppStateForLocalStorage(appState)),
  );
}

export async function loadScene() {
  const data = restoreFromLocalStorage();

  return {
    elements: data.elements,
    appState: data.appState && { ...data.appState, undefined },
  };
}

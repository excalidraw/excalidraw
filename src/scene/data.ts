import rough from "roughjs/bin/rough";

import { ExcalidrawElement } from "../element/types";

import { getElementAbsoluteCoords } from "../element";
import { getDefaultAppState } from "../appState";

import { renderScene } from "../renderer";
import { AppState } from "../types";
import { ExportType } from "./types";
import nanoid from "nanoid";

const LOCAL_STORAGE_KEY = "excalidraw";
const LOCAL_STORAGE_KEY_STATE = "excalidraw-state";

// TODO: Defined globally, since file handles aren't yet serializable.
// Once `FileSystemFileHandle` can be serialized, make this
// part of `AppState`.
(window as any).handle = null;

function saveFile(name: string, data: string) {
  // create a temporary <a> elem which we'll use to download the image
  const link = document.createElement("a");
  link.setAttribute("download", name);
  link.setAttribute("href", data);
  link.click();

  // clean up
  link.remove();
}

async function saveFileNative(name: string, data: Blob) {
  const options = {
    type: "saveFile",
    accepts: [
      {
        description: `Excalidraw ${
          data.type === "image/png" ? "image" : "file"
        }`,
        extensions: [data.type.split("/")[1]],
        mimeTypes: [data.type]
      }
    ]
  };
  try {
    let handle;
    if (data.type === "application/json") {
      // For Excalidraw files (i.e., `application/json` files):
      // If it exists, write back to a previously opened file.
      // Else, create a new file.
      if ((window as any).handle) {
        handle = (window as any).handle;
      } else {
        handle = await (window as any).chooseFileSystemEntries(options);
        (window as any).handle = handle;
      }
    } else {
      // For image export files (i.e., `image/png` files):
      // Always create a new file.
      handle = await (window as any).chooseFileSystemEntries(options);
    }
    const writer = await handle.createWriter();
    await writer.truncate(0);
    await writer.write(0, data, data.type);
    await writer.close();
  } catch (err) {
    if (err.name !== "AbortError") {
      console.error(err.name, err.message);
    }
    throw err;
  }
}

interface DataState {
  elements: readonly ExcalidrawElement[];
  appState: AppState;
}

export async function saveAsJSON(
  elements: readonly ExcalidrawElement[],
  appState: AppState
) {
  const serialized = JSON.stringify({
    version: 1,
    source: window.location.origin,
    elements: elements.map(({ shape, ...el }) => el),
    appState: appState
  });

  const name = `${appState.name}.json`;
  if ("chooseFileSystemEntries" in window) {
    await saveFileNative(
      name,
      new Blob([serialized], { type: "application/json" })
    );
  } else {
    saveFile(
      name,
      "data:text/plain;charset=utf-8," + encodeURIComponent(serialized)
    );
  }
}

export async function loadFromJSON() {
  const updateAppState = (contents: string) => {
    const defaultAppState = getDefaultAppState();
    let elements = [];
    let appState = defaultAppState;
    try {
      const data = JSON.parse(contents);
      elements = data.elements || [];
      appState = { ...defaultAppState, ...data.appState };
    } catch (e) {
      // Do nothing because elements array is already empty
    }
    return { elements, appState };
  };

  if ("chooseFileSystemEntries" in window) {
    try {
      (window as any).handle = await (window as any).chooseFileSystemEntries({
        accepts: [
          {
            description: "Excalidraw files",
            extensions: ["json"],
            mimeTypes: ["application/json"]
          }
        ]
      });
      const file = await (window as any).handle.getFile();
      const contents = await file.text();
      const { elements, appState } = updateAppState(contents);
      return new Promise<DataState>(resolve => {
        resolve(restore(elements, appState));
      });
    } catch (err) {
      if (err.name !== "AbortError") {
        console.error(err.name, err.message);
      }
      throw err;
    }
  } else {
    const input = document.createElement("input");
    const reader = new FileReader();
    input.type = "file";
    input.accept = ".json";

    input.onchange = () => {
      if (!input.files!.length) {
        alert("A file was not selected.");
        return;
      }

      reader.readAsText(input.files![0], "utf8");
    };

    input.click();

    return new Promise<DataState>(resolve => {
      reader.onloadend = () => {
        if (reader.readyState === FileReader.DONE) {
          const { elements, appState } = updateAppState(
            reader.result as string
          );
          resolve(restore(elements, appState));
        }
      };
    });
  }
}

export function getExportCanvasPreview(
  elements: readonly ExcalidrawElement[],
  {
    exportBackground,
    exportPadding = 10,
    viewBackgroundColor,
    scale = 1
  }: {
    exportBackground: boolean;
    exportPadding?: number;
    scale?: number;
    viewBackgroundColor: string;
  }
) {
  // calculate smallest area to fit the contents in
  let subCanvasX1 = Infinity;
  let subCanvasX2 = 0;
  let subCanvasY1 = Infinity;
  let subCanvasY2 = 0;

  elements.forEach(element => {
    const [x1, y1, x2, y2] = getElementAbsoluteCoords(element);
    subCanvasX1 = Math.min(subCanvasX1, x1);
    subCanvasY1 = Math.min(subCanvasY1, y1);
    subCanvasX2 = Math.max(subCanvasX2, x2);
    subCanvasY2 = Math.max(subCanvasY2, y2);
  });

  function distance(x: number, y: number) {
    return Math.abs(x > y ? x - y : y - x);
  }

  const tempCanvas = document.createElement("canvas");
  const width = distance(subCanvasX1, subCanvasX2) + exportPadding * 2;
  const height = distance(subCanvasY1, subCanvasY2) + exportPadding * 2;
  tempCanvas.style.width = width + "px";
  tempCanvas.style.height = height + "px";
  tempCanvas.width = width * scale;
  tempCanvas.height = height * scale;
  tempCanvas.getContext("2d")?.scale(scale, scale);

  renderScene(
    elements,
    rough.canvas(tempCanvas),
    tempCanvas,
    {
      viewBackgroundColor: exportBackground ? viewBackgroundColor : null,
      scrollX: 0,
      scrollY: 0
    },
    {
      offsetX: -subCanvasX1 + exportPadding,
      offsetY: -subCanvasY1 + exportPadding,
      renderScrollbars: false,
      renderSelection: false
    }
  );
  return tempCanvas;
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
    scale = 1
  }: {
    exportBackground: boolean;
    exportPadding?: number;
    viewBackgroundColor: string;
    name: string;
    scale?: number;
  }
) {
  if (!elements.length) return window.alert("Cannot export empty canvas.");
  // calculate smallest area to fit the contents in

  const tempCanvas = getExportCanvasPreview(elements, {
    exportBackground,
    viewBackgroundColor,
    exportPadding,
    scale
  });
  tempCanvas.style.display = "none";
  document.body.appendChild(tempCanvas);

  if (type === "png") {
    const fileName = `${name}.png`;
    if ("chooseFileSystemEntries" in window) {
      tempCanvas.toBlob(async blob => {
        if (blob) {
          await saveFileNative(fileName, blob);
        }
      });
    } else {
      saveFile(fileName, tempCanvas.toDataURL("image/png"));
    }
  } else if (type === "clipboard") {
    try {
      tempCanvas.toBlob(async function(blob) {
        try {
          await navigator.clipboard.write([
            new window.ClipboardItem({ "image/png": blob })
          ]);
        } catch (err) {
          window.alert("Couldn't copy to clipboard. Try using Chrome browser.");
        }
      });
    } catch (err) {
      window.alert("Couldn't copy to clipboard. Try using Chrome browser.");
    }
  }

  // clean up the DOM
  if (tempCanvas !== canvas) tempCanvas.remove();
}

function restore(
  savedElements: readonly ExcalidrawElement[],
  savedState: AppState
): DataState {
  return {
    elements: savedElements.map(element => ({
      ...element,
      id: element.id || nanoid(),
      fillStyle: element.fillStyle || "hachure",
      strokeWidth: element.strokeWidth || 1,
      roughness: element.roughness || 1,
      opacity:
        element.opacity === null || element.opacity === undefined
          ? 100
          : element.opacity
    })),
    appState: savedState
  };
}

export function restoreFromLocalStorage() {
  const savedElements = localStorage.getItem(LOCAL_STORAGE_KEY);
  const savedState = localStorage.getItem(LOCAL_STORAGE_KEY_STATE);

  let elements = [];
  if (savedElements) {
    try {
      elements = JSON.parse(savedElements).map(
        ({ shape, ...element }: ExcalidrawElement) => element
      );
    } catch (e) {
      // Do nothing because elements array is already empty
    }
  }

  let appState = null;
  if (savedState) {
    try {
      appState = JSON.parse(savedState);
    } catch (e) {
      // Do nothing because appState is already null
    }
  }

  return restore(elements, appState);
}

export function saveToLocalStorage(
  elements: readonly ExcalidrawElement[],
  state: AppState
) {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(elements));
  localStorage.setItem(LOCAL_STORAGE_KEY_STATE, JSON.stringify(state));
}

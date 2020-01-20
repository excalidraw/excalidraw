import { ExcalidrawElement } from "../element/types";

import { getDefaultAppState } from "../appState";

import { AppState } from "../types";
import { ExportType } from "./types";
import { getExportCanvasPreview } from "./getExportCanvasPreview";
import nanoid from "nanoid";

const LOCAL_STORAGE_KEY = "excalidraw";
const LOCAL_STORAGE_KEY_STATE = "excalidraw-state";
const BACKEND_POST = "https://json.excalidraw.com/api/v1/post/";
const BACKEND_GET = "https://json.excalidraw.com/api/v1/";

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

export function serializeAsJSON(
  elements: readonly ExcalidrawElement[],
  appState?: AppState
): string {
  return JSON.stringify({
    version: 1,
    source: window.location.origin,
    elements: elements.map(({ shape, ...el }) => el),
    appState: appState || getDefaultAppState()
  });
}

export async function saveAsJSON(
  elements: readonly ExcalidrawElement[],
  appState: AppState
) {
  const serialized = serializeAsJSON(elements, appState);

  const name = `${appState.name}.json`;
  if ("chooseFileSystemEntries" in window) {
    await saveFileNative(
      name,
      new Blob([serialized], { type: "application/json" })
    );
  } else {
    saveFile(
      name,
      "data:application/json;charset=utf-8," + encodeURIComponent(serialized)
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

export async function exportToBackend(elements: readonly ExcalidrawElement[]) {
  const response = await fetch(BACKEND_POST, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: serializeAsJSON(elements)
  });
  const json = await response.json();
  if (json.hash) {
    const url = new URL(window.location.href);
    url.searchParams.append("json", json.hash);

    await navigator.clipboard.writeText(url.toString());
    window.alert("Copied shareable link " + url.toString() + " to clipboard");
  } else {
    window.alert("Couldn't create shareable link");
  }
}

export async function importFromBackend(hash: string | null) {
  let elements: readonly ExcalidrawElement[] = [];
  let appState: AppState = getDefaultAppState();
  const response = await fetch(`${BACKEND_GET}${hash}.json`).then(data =>
    data.clone().json()
  );
  if (response != null) {
    try {
      elements = response.elements || elements;
      appState = response.appState || appState;
    } catch (error) {
      window.alert("Importing from backend failed");
      console.error(error);
    }
  }
  return restore(elements, appState);
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
      tempCanvas.toBlob(async (blob: any) => {
        if (blob) {
          await saveFileNative(fileName, blob);
        }
      });
    } else {
      saveFile(fileName, tempCanvas.toDataURL("image/png"));
    }
  } else if (type === "clipboard") {
    try {
      tempCanvas.toBlob(async function(blob: any) {
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
  } else if (type === "backend") {
    exportToBackend(elements);
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

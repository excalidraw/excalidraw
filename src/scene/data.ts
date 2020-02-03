import { ExcalidrawElement } from "../element/types";

import {
  getDefaultAppState,
  cleanAppStateForExport,
  clearAppStateForLocalStorage,
} from "../appState";

import { AppState } from "../types";
import { ExportType, PreviousScene } from "./types";
import { exportToCanvas, exportToSvg } from "./export";
import nanoid from "nanoid";
import { fileOpen, fileSave } from "browser-nativefs";
import { getCommonBounds, normalizeDimensions } from "../element";

import { Point } from "roughjs/bin/geometry";
import { t } from "../i18n";
import {
  copyTextToSystemClipboard,
  copyCanvasToClipboardAsPng,
} from "../clipboard";

const LOCAL_STORAGE_KEY = "excalidraw";
const LOCAL_STORAGE_SCENE_PREVIOUS_KEY = "excalidraw-previos-scenes";
const LOCAL_STORAGE_KEY_STATE = "excalidraw-state";
const BACKEND_POST = "https://json.excalidraw.com/api/v1/post/";
const BACKEND_GET = "https://json.excalidraw.com/api/v1/";

const BACKEND_V2_POST = "https://json.excalidraw.com/api/v2/post/";
const BACKEND_V2_GET = "https://json.excalidraw.com/api/v2/post/";

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
      elements: elements.map(({ shape, isSelected, ...el }) => el),
      appState: cleanAppStateForExport(appState),
    },
    null,
    2,
  );
}

export function calculateScrollCenter(
  elements: readonly ExcalidrawElement[],
): { scrollX: number; scrollY: number } {
  const [x1, y1, x2, y2] = getCommonBounds(elements);

  const centerX = (x1 + x2) / 2;
  const centerY = (y1 + y2) / 2;

  return {
    scrollX: window.innerWidth / 2 - centerX,
    scrollY: window.innerHeight / 2 - centerY,
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
    contents = await (async () => {
      return new Promise(resolve => {
        const reader = new FileReader();
        reader.readAsText(blob, "utf8");
        reader.onloadend = () => {
          if (reader.readyState === FileReader.DONE) {
            resolve(reader.result as string);
          }
        };
      });
    })();
  }
  const { elements, appState } = updateAppState(contents);
  if (!elements.length) {
    return Promise.reject("Cannot load invalid json");
  }
  return new Promise<DataState>(resolve => {
    resolve(restore(elements, appState, { scrollToContent: true }));
  });
}

export async function exportToBackend(
  elements: readonly ExcalidrawElement[],
  appState: AppState,
) {
  const json = serializeAsJSON(elements, appState);
  const encoded = new TextEncoder().encode(json);

  const key = await window.crypto.subtle.generateKey(
    {
      name: "AES-GCM",
      length: 128
    },
    true, // extractable
    ["encrypt", "decrypt"]
  );
  // The iv is set to 0. We are never going to reuse the same key so we don't
  // need to have an iv. (I hope that's correct...)
  const iv = new Uint8Array(12);
  // We use symmetric encryption. AES-GCM is the recommended algorithm and
  // includes checks that the ciphertext has not been modified by an attacker.
  const encrypted = await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv
    },
    key,
    encoded
  );
  // We use jwk encoding to be able to extract just the base64 encoded key.
  // We will hardcode the rest of the attributes when importing back the key.
  const exportedKey = await window.crypto.subtle.exportKey("jwk", key);

  try {
    const response = await fetch(BACKEND_V2_POST, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      mode: "no-cors",
      body: encrypted,
    });
    const json = await response.json();
    // TODO: comment following
    // const json = {id: '1234'}
    // console.log("new Uint8Array([" + new Uint8Array(encrypted).join(",") + "])");

    if (json.id) {
      const url = new URL(window.location.href);
      // We need to store the key (and less importantly the id) as hash instead
      // of queryParam in order to never send it to the server
      url.hash = 'json=' + json.id + ',' + exportedKey.k!;
      const urlString = url.toString();

      try {
        await copyTextToSystemClipboard(urlString);
        window.alert(t("alerts.copiedToClipboard", { url: urlString }));
      } catch (err) {
        // TODO: link will be displayed for user to copy manually in later PR
      }
    } else {
      window.alert(t("alerts.couldNotCreateShareableLink"));
    }
  } catch (e) {
    console.error(e);
    window.alert(t("alerts.couldNotCreateShareableLink"));
  }
}

export async function importFromBackend(id: string | null, k: string | undefined) {
  let elements: readonly ExcalidrawElement[] = [];
  let appState: AppState = getDefaultAppState();

  try {
    const response = await fetch(`${BACKEND_GET}${id}.json`)
    // TODO: uncomment the following block
    // if (!response.ok) {
    //   window.alert(t("alerts.importBackendFailed"));
    //   return restore(elements, { ...appState, ...calculateScrollCenter(elements) });
    // }
    let data;
    if (k) {
      // TODO: uncomment next line and comment line after
      // const buffer = await response.arrayBuffer();
      const buffer: any = new Uint8Array([202,191,73,59,84,92,50,53,212,83,106,18,187,251,136,23,197,137,178,66,92,217,210,60,220,121,223,220,1,216,115,130,54,114,138,179,52,150,145,182,142,253,86,115,194,56,115,195,184,189,98,191,10,78,182,150,153,243,107,71,122,38,21,252,246,165,82,178,240,152,169,16,226,82,13,129,246,182,144,115,193,232,18,79,165,196,119,59,177,137,5,117,3,169,81,127,181,42,123,150,196,133,85,90,87,114,196,54,27,143,176,238,91,197,150,134,178,34,40,71,29,123,30,39,193,117,125,153,94,127,222,105,149,188,240,135,210,35,122,128,139,58,35,167,85,214,63,25,110,150,200,178,111,226,204,185,175,207,42,190,21,248,141,22,167,145,179,207,93,38,10,250,48,82,35,41,59,234,9,217,165,28,192,138,216,103,221,215,5,55,120,240,245,179,12,16,241,198,183,60,240,190,213,115,55,241,235,180,170,116,231,220,207,95,138,2,146,230,125,49,108,163,168,106,254,83,12,164,183,72,221,159,91,106,194,185,9,229,253,78,205,131,227,51,241,143,251,55,248,95,192,4,195,1,63,125,182,188,174,74,160,29,64,219,239,153,250,238,46,210,56,10,101,102,15,150,30,32,94,126,69,204,144,199,36,160,158,235,61,186,122,52,156,119,102,218,17,234,50,133,167,149,40,214,85,99,164,112,0,253,121,123,31,213,174,173,124,153,243,20,164,140,93,125,178,209,221,106,229,56,149,146,130,10,246,92,195,206,15,175,36,107,226,97,204,244,114,83,50,108,167,21,125,48,121,220,149,171,161,34,18,205,81,37,47,157,23,225,119,234,134,32,144,118,52,217,222,24,67,112,129,200,27,63,88,134,30,127,135,77,80,69,145,208,231,76,12,49,172,188,31,24,154,115,25,173,226,169,139,120,204,32,92,209,233,233,16,63,38,108,203,169,117,238,140,3,20,89,92,200,120,22,23,15,63,255,145,80,78,238,49,48,201,245,117,138,152,49,40,0,72,159,34,189,63,26,183,253,212,253,143,40,249,131,91,89,110,26,128,20,148,16,98,226,218,2,145,72,170]).buffer;

      const key = await window.crypto.subtle.importKey(
        "jwk",
        {
          alg: "A128GCM",
          ext: true,
          k: k,
          key_ops: ["encrypt", "decrypt"],
          kty: "oct"
        },
        {
          name: "AES-GCM",
          length: 128
        },
        false, // extractable
        ["decrypt"]
      );
      const iv = new Uint8Array(12);
      const decrypted = await window.crypto.subtle.decrypt(
        {
          name: "AES-GCM",
          iv: iv
        },
        key,
        buffer
      );
      // We need to convert the decrypted array buffer to a string
      const string = String.fromCharCode.apply(null, (new Uint8Array(decrypted) as any));
      data = JSON.parse(string);
    } else {
      // Legacy format
      data = await response.json();
    }

    elements = data.elements || elements;
    appState = data.appState || appState;
  } catch (error) {
    window.alert(t("alerts.importBackendFailed"));
    console.error(error);
  } finally {
    return restore(elements, { ...appState, ...calculateScrollCenter(elements) });
  }
<<<<<<< HEAD
  return restore(elements, appState, { scrollToContent: true });
=======
>>>>>>> Add encryption
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
  } else if (type === "backend") {
    const appState = getDefaultAppState();
    if (exportBackground) {
      appState.viewBackgroundColor = viewBackgroundColor;
    }
    exportToBackend(elements, appState);
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
  const elements = savedElements.map(element => {
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
    };
  });

  if (opts?.scrollToContent && savedState) {
    savedState = { ...savedState, ...calculateScrollCenter(elements) };
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
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(elements));
  localStorage.setItem(
    LOCAL_STORAGE_KEY_STATE,
    JSON.stringify(clearAppStateForLocalStorage(appState)),
  );
}

/**
 * Returns the list of ids in Local Storage
 * @returns array
 */
export function loadedScenes(): PreviousScene[] {
  const storedPreviousScenes = localStorage.getItem(
    LOCAL_STORAGE_SCENE_PREVIOUS_KEY,
  );
  if (storedPreviousScenes) {
    try {
      return JSON.parse(storedPreviousScenes);
    } catch (e) {
      console.error("Could not parse previously stored ids");
      return [];
    }
  }
  return [];
}

/**
 * Append id to the list of Previous Scenes in Local Storage if not there yet
 * @param id string
 */
export function addToLoadedScenes(id: string, k: string | undefined): void {
  const scenes = [...loadedScenes()];
  const newScene = scenes.every(scene => scene.id !== id);

  if (newScene) {
    scenes.push({
      timestamp: Date.now(),
      id,
      k
    });
  }

  localStorage.setItem(
    LOCAL_STORAGE_SCENE_PREVIOUS_KEY,
    JSON.stringify(scenes),
  );
}

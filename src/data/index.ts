import {
  ExcalidrawElement,
  NonDeletedExcalidrawElement,
} from "../element/types";

import { getDefaultAppState } from "../appState";

import { AppState } from "../types";
import { exportToCanvas, exportToSvg } from "../scene/export";
import { fileSave } from "browser-nativefs";

import { t } from "../i18n";
import {
  copyCanvasToClipboardAsPng,
  copyCanvasToClipboardAsSvg,
} from "../clipboard";
import { serializeAsJSON } from "./json";

import { ExportType } from "../scene/types";
import { restore } from "./restore";
import { restoreFromLocalStorage } from "./localStorage";

export { loadFromBlob } from "./blob";
export { saveAsJSON, loadFromJSON } from "./json";
export { saveToLocalStorage } from "./localStorage";

const BACKEND_GET = "https://json.excalidraw.com/api/v1/";

const BACKEND_V2_POST = "https://json.excalidraw.com/api/v2/post/";
const BACKEND_V2_GET = "https://json.excalidraw.com/api/v2/";

export const SOCKET_SERVER = "https://excalidraw-socket.herokuapp.com";

export type EncryptedData = {
  data: ArrayBuffer;
  iv: Uint8Array;
};

export type SocketUpdateDataSource = {
  SCENE_INIT: {
    type: "SCENE_INIT";
    payload: {
      elements: readonly ExcalidrawElement[];
    };
  };
  SCENE_UPDATE: {
    type: "SCENE_UPDATE";
    payload: {
      elements: readonly ExcalidrawElement[];
    };
  };
  MOUSE_LOCATION: {
    type: "MOUSE_LOCATION";
    payload: {
      socketID: string;
      pointerCoords: { x: number; y: number };
      button: "down" | "up";
      selectedElementIds: AppState["selectedElementIds"];
      username: string;
    };
  };
};

export type SocketUpdateDataIncoming =
  | SocketUpdateDataSource[keyof SocketUpdateDataSource]
  | {
      type: "INVALID_RESPONSE";
    };

// TODO: Defined globally, since file handles aren't yet serializable.
// Once `FileSystemFileHandle` can be serialized, make this
// part of `AppState`.
(window as any).handle = null;

function byteToHex(byte: number): string {
  return `0${byte.toString(16)}`.slice(-2);
}

async function generateRandomID() {
  const arr = new Uint8Array(10);
  window.crypto.getRandomValues(arr);
  return Array.from(arr, byteToHex).join("");
}

async function generateEncryptionKey() {
  const key = await window.crypto.subtle.generateKey(
    {
      name: "AES-GCM",
      length: 128,
    },
    true, // extractable
    ["encrypt", "decrypt"],
  );
  return (await window.crypto.subtle.exportKey("jwk", key)).k;
}

function createIV() {
  const arr = new Uint8Array(12);
  return window.crypto.getRandomValues(arr);
}

export function getCollaborationLinkData(link: string) {
  if (link.length === 0) {
    return;
  }
  const hash = new URL(link).hash;
  return hash.match(/^#room=([a-zA-Z0-9_-]+),([a-zA-Z0-9_-]+)$/);
}

export async function generateCollaborationLink() {
  const id = await generateRandomID();
  const key = await generateEncryptionKey();
  return `${window.location.origin}${window.location.pathname}#room=${id},${key}`;
}

function getImportedKey(key: string, usage: string) {
  return window.crypto.subtle.importKey(
    "jwk",
    {
      alg: "A128GCM",
      ext: true,
      k: key,
      key_ops: ["encrypt", "decrypt"],
      kty: "oct",
    },
    {
      name: "AES-GCM",
      length: 128,
    },
    false, // extractable
    [usage],
  );
}

export async function encryptAESGEM(
  data: Uint8Array,
  key: string,
): Promise<EncryptedData> {
  const importedKey = await getImportedKey(key, "encrypt");
  const iv = createIV();
  return {
    data: await window.crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv,
      },
      importedKey,
      data,
    ),
    iv,
  };
}

export async function decryptAESGEM(
  data: ArrayBuffer,
  key: string,
  iv: Uint8Array,
): Promise<SocketUpdateDataIncoming> {
  try {
    const importedKey = await getImportedKey(key, "decrypt");
    const decrypted = await window.crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: iv,
      },
      importedKey,
      data,
    );

    const decodedData = new TextDecoder("utf-8").decode(
      new Uint8Array(decrypted) as any,
    );
    return JSON.parse(decodedData);
  } catch (error) {
    window.alert(t("alerts.decryptFailed"));
    console.error(error);
  }
  return {
    type: "INVALID_RESPONSE",
  };
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
      length: 128,
    },
    true, // extractable
    ["encrypt", "decrypt"],
  );
  // The iv is set to 0. We are never going to reuse the same key so we don't
  // need to have an iv. (I hope that's correct...)
  const iv = new Uint8Array(12);
  // We use symmetric encryption. AES-GCM is the recommended algorithm and
  // includes checks that the ciphertext has not been modified by an attacker.
  const encrypted = await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv,
    },
    key,
    encoded,
  );
  // We use jwk encoding to be able to extract just the base64 encoded key.
  // We will hardcode the rest of the attributes when importing back the key.
  const exportedKey = await window.crypto.subtle.exportKey("jwk", key);

  try {
    const response = await fetch(BACKEND_V2_POST, {
      method: "POST",
      body: encrypted,
    });
    const json = await response.json();
    if (json.id) {
      const url = new URL(window.location.href);
      // We need to store the key (and less importantly the id) as hash instead
      // of queryParam in order to never send it to the server
      url.hash = `json=${json.id},${exportedKey.k!}`;
      const urlString = url.toString();

      window.prompt(`🔒${t("alerts.uploadedSecurly")}`, urlString);
    } else {
      window.alert(t("alerts.couldNotCreateShareableLink"));
    }
  } catch (error) {
    console.error(error);
    window.alert(t("alerts.couldNotCreateShareableLink"));
  }
}

export async function importFromBackend(
  id: string | null,
  privateKey: string | undefined,
) {
  let elements: readonly ExcalidrawElement[] = [];
  let appState: AppState = getDefaultAppState();

  try {
    const response = await fetch(
      privateKey ? `${BACKEND_V2_GET}${id}` : `${BACKEND_GET}${id}.json`,
    );
    if (!response.ok) {
      window.alert(t("alerts.importBackendFailed"));
      return restore(elements, appState, { scrollToContent: true });
    }
    let data;
    if (privateKey) {
      const buffer = await response.arrayBuffer();
      const key = await getImportedKey(privateKey, "decrypt");
      const iv = new Uint8Array(12);
      const decrypted = await window.crypto.subtle.decrypt(
        {
          name: "AES-GCM",
          iv: iv,
        },
        key,
        buffer,
      );
      // We need to convert the decrypted array buffer to a string
      const string = new window.TextDecoder("utf-8").decode(
        new Uint8Array(decrypted) as any,
      );
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
    return restore(elements, appState, { scrollToContent: true });
  }
}

export async function exportCanvas(
  type: ExportType,
  elements: readonly NonDeletedExcalidrawElement[],
  appState: AppState,
  canvas: HTMLCanvasElement,
  {
    exportBackground,
    exportPadding = 10,
    viewBackgroundColor,
    name,
    scale = 1,
    shouldAddWatermark,
  }: {
    exportBackground: boolean;
    exportPadding?: number;
    viewBackgroundColor: string;
    name: string;
    scale?: number;
    shouldAddWatermark: boolean;
  },
) {
  if (elements.length === 0) {
    return window.alert(t("alerts.cannotExportEmptyCanvas"));
  }
  if (type === "svg" || type === "clipboard-svg") {
    const tempSvg = exportToSvg(elements, {
      exportBackground,
      viewBackgroundColor,
      exportPadding,
      shouldAddWatermark,
    });
    if (type === "svg") {
      await fileSave(new Blob([tempSvg.outerHTML], { type: "image/svg+xml" }), {
        fileName: `${name}.svg`,
      });
      return;
    } else if (type === "clipboard-svg") {
      copyCanvasToClipboardAsSvg(tempSvg);
      return;
    }
  }

  const tempCanvas = exportToCanvas(elements, appState, {
    exportBackground,
    viewBackgroundColor,
    exportPadding,
    scale,
    shouldAddWatermark,
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
    } catch {
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

export async function loadScene(id: string | null, privateKey?: string) {
  let data;
  if (id != null) {
    // the private key is used to decrypt the content from the server, take
    // extra care not to leak it
    data = await importFromBackend(id, privateKey);
    window.history.replaceState({}, "Excalidraw", window.location.origin);
  } else {
    data = restoreFromLocalStorage();
  }

  return {
    elements: data.elements,
    appState: data.appState && { ...data.appState },
    commitToHistory: false,
  };
}

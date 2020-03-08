import { ExcalidrawElement } from "../element/types";

import { getDefaultAppState } from "../appState";

import { AppState } from "../types";
import { exportToCanvas, exportToSvg } from "../scene/export";
import { fileSave } from "browser-nativefs";

import { t } from "../i18n";
import { copyCanvasToClipboardAsPng } from "../clipboard";
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

// TODO: Defined globally, since file handles aren't yet serializable.
// Once `FileSystemFileHandle` can be serialized, make this
// part of `AppState`.
(window as any).handle = null;

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
      const key = await window.crypto.subtle.importKey(
        "jwk",
        {
          alg: "A128GCM",
          ext: true,
          k: privateKey,
          key_ops: ["encrypt", "decrypt"],
          kty: "oct",
        },
        {
          name: "AES-GCM",
          length: 128,
        },
        false, // extractable
        ["decrypt"],
      );
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
  elements: readonly ExcalidrawElement[],
  appState: AppState,
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

  const tempCanvas = exportToCanvas(elements, appState, {
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
  let selectedId;
  if (id != null) {
    // the private key is used to decrypt the content from the server, take
    // extra care not to leak it
    data = await importFromBackend(id, privateKey);
    selectedId = id;
    window.history.replaceState({}, "Excalidraw", window.location.origin);
  } else {
    data = restoreFromLocalStorage();
  }

  return {
    elements: data.elements,
    appState: data.appState && { ...data.appState, selectedId },
  };
}

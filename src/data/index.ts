import { ExcalidrawElement } from "../element/types";

import { AppState } from "../types";
import { exportToCanvas, exportToSvg } from "../scene/export";
import { fileSave } from "browser-nativefs";

import { t } from "../i18n";
import { copyCanvasToClipboardAsPng } from "../clipboard";

import { ExportType } from "../scene/types";
import { restoreFromLocalStorage } from "./localStorage";

export { loadFromBlob } from "./blob";
export { saveAsJSON, loadFromJSON } from "./json";
export { saveToLocalStorage } from "./localStorage";

export type EncryptedData = {
  data: ArrayBuffer;
  iv: Uint8Array;
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
  return `${window.location.href}#room=${id},${key}`;
}

async function getImportedKey(key: string, usage: string): Promise<CryptoKey> {
  return await window.crypto.subtle.importKey(
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
  }

  // clean up the DOM
  if (tempCanvas !== canvas) {
    tempCanvas.remove();
  }
}

export async function loadScene() {
  let selectedId;
  const data = restoreFromLocalStorage();

  return {
    elements: data.elements,
    appState: data.appState && { ...data.appState, selectedId },
  };
}

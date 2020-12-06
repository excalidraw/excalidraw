import { fileSave } from "browser-nativefs";
import { EVENT_IO, trackEvent } from "../analytics";
import { getDefaultAppState } from "../appState";
import {
  copyCanvasToClipboardAsPng,
  copyTextToSystemClipboard,
} from "../clipboard";
import {
  ExcalidrawElement,
  NonDeletedExcalidrawElement,
} from "../element/types";
import { t } from "../i18n";
import { exportToCanvas, exportToSvg } from "../scene/export";
import { ExportType } from "../scene/types";
import { canvasToBlob } from "./blob";
import { AppState } from "../types";
import { serializeAsJSON } from "./json";

export { loadFromBlob } from "./blob";
export { loadFromJSON, saveAsJSON } from "./json";

const BACKEND_V2_POST = process.env.REACT_APP_BACKEND_V2_POST_URL;

export const exportToBackend = async (
  elements: readonly ExcalidrawElement[],
  appState: AppState,
) => {
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
      iv,
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
      trackEvent(EVENT_IO, "export", "backend");
    } else if (json.error_class === "RequestTooLargeError") {
      window.alert(t("alerts.couldNotCreateShareableLinkTooBig"));
    } else {
      window.alert(t("alerts.couldNotCreateShareableLink"));
    }
  } catch (error) {
    console.error(error);
    window.alert(t("alerts.couldNotCreateShareableLink"));
  }
};

export const exportCanvas = async (
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
) => {
  if (elements.length === 0) {
    return window.alert(t("alerts.cannotExportEmptyCanvas"));
  }
  if (type === "svg" || type === "clipboard-svg") {
    const tempSvg = exportToSvg(elements, {
      exportBackground,
      viewBackgroundColor,
      exportPadding,
      scale,
      shouldAddWatermark,
      metadata:
        appState.exportEmbedScene && type === "svg"
          ? await (
              await import(/* webpackChunkName: "image" */ "./image")
            ).encodeSvgMetadata({
              text: serializeAsJSON(elements, appState),
            })
          : undefined,
    });
    if (type === "svg") {
      await fileSave(new Blob([tempSvg.outerHTML], { type: "image/svg+xml" }), {
        fileName: `${name}.svg`,
        extensions: [".svg"],
      });
      trackEvent(EVENT_IO, "export", "svg");
      return;
    } else if (type === "clipboard-svg") {
      trackEvent(EVENT_IO, "export", "clipboard-svg");
      copyTextToSystemClipboard(tempSvg.outerHTML);
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
    let blob = await canvasToBlob(tempCanvas);
    if (appState.exportEmbedScene) {
      blob = await (
        await import(/* webpackChunkName: "image" */ "./image")
      ).encodePngMetadata({
        blob,
        metadata: serializeAsJSON(elements, appState),
      });
    }

    await fileSave(blob, {
      fileName,
      extensions: [".png"],
    });
    trackEvent(EVENT_IO, "export", "png");
  } else if (type === "clipboard") {
    try {
      await copyCanvasToClipboardAsPng(tempCanvas);
      trackEvent(EVENT_IO, "export", "clipboard-png");
    } catch (error) {
      if (error.name === "CANVAS_POSSIBLY_TOO_BIG") {
        throw error;
      }
      throw new Error(t("alerts.couldNotCopyToClipboard"));
    }
  } else if (type === "backend") {
    exportToBackend(elements, {
      ...appState,
      viewBackgroundColor: exportBackground
        ? appState.viewBackgroundColor
        : getDefaultAppState().viewBackgroundColor,
    });
  }

  // clean up the DOM
  if (tempCanvas !== canvas) {
    tempCanvas.remove();
  }
};

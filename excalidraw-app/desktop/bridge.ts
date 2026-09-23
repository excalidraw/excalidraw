import { isTauri, invoke } from "@tauri-apps/api/core";
import { MIME_TYPES } from "@excalidraw/excalidraw/constants";
import { loadFromBlob } from "@excalidraw/excalidraw/data/blob";
import { isValidExcalidrawData } from "@excalidraw/excalidraw/data/json";
import type {
  DesktopFileBridge,
  FileOpenOptions,
} from "@excalidraw/excalidraw/data/filesystem";
import { AbortError } from "@excalidraw/excalidraw/errors";

/** Keep this in sync with src-tauri/src/document.rs. */
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

export type DesktopInvoke = (
  command: string,
  args?: Record<string, unknown>,
) => Promise<unknown>;

export const isDesktop = () => isTauri();

const readBlobText = async (blob: Blob) => {
  if (typeof blob.text === "function") {
    return blob.text();
  }
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
};

// Only check size and basic scene shape here. The native boundary owns the
// complete document schema and file validation.
export const validateDocument = (contents: unknown) => {
  if (typeof contents !== "string") {
    throw new Error("Invalid desktop document contents.");
  }
  if (new TextEncoder().encode(contents).byteLength > MAX_DOCUMENT_BYTES) {
    throw new Error("Document exceeds the 10 MiB desktop limit.");
  }
  const data: unknown = JSON.parse(contents);
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Invalid Excalidraw document.");
  }
  if (isValidExcalidrawData(data)) {
    if (
      !Array.isArray(data.elements) ||
      !data.elements.every(
        (element) =>
          element && typeof element === "object" && !Array.isArray(element),
      )
    ) {
      throw new Error("Invalid Excalidraw elements.");
    }
  } else {
    throw new Error("Invalid Excalidraw document.");
  }
  return data;
};

export const createDesktopFileBridge = (
  call: DesktopInvoke = invoke,
): DesktopFileBridge => ({
  async fileOpen<M extends boolean | undefined = false>(
    opts: FileOpenOptions<M>,
  ) {
    if (opts.multiple) {
      throw new Error(
        "Desktop document import supports one document at a time.",
      );
    }
    const document = await call("open_document");
    if (document === null) {
      throw new AbortError();
    }
    if (
      !document ||
      typeof document !== "object" ||
      Array.isArray(document) ||
      !("name" in document) ||
      typeof document.name !== "string" ||
      !document.name ||
      !("contents" in document) ||
      typeof document.contents !== "string"
    ) {
      throw new Error("Invalid desktop document response.");
    }
    validateDocument(document.contents);
    const file = new File([document.contents], document.name, {
      type: MIME_TYPES.json,
    });
    return file as M extends false | undefined ? File : File[];
  },
  async fileSave(blobPromise, opts) {
    if (!["json", "excalidraw"].includes(opts.extension)) {
      throw new Error("Unsupported desktop document extension.");
    }
    const blob = await blobPromise;
    if (blob.size > MAX_DOCUMENT_BYTES) {
      throw new Error("Document exceeds the 10 MiB desktop limit.");
    }
    const contents = await readBlobText(blob);
    validateDocument(contents);
    const saved = await call("save_document", {
      request: { contents, extension: opts.extension },
    });
    if (saved === false) {
      throw new AbortError();
    }
    if (saved !== true) {
      throw new Error("Invalid desktop save response.");
    }
    // Never return an OS path or emulate a persistent browser file handle.
    // Each save asks the user to authorize a destination again.
    return null;
  },
});

export const installDesktopBridge = () => {
  if (isDesktop()) {
    window.__EXCALIDRAW_DESKTOP__ = createDesktopFileBridge();
  }
};

let pendingPersistence: string | (() => string) | null = null;
let persistenceTimer: number | null = null;
let persistenceQueue: Promise<void> = Promise.resolve();

const writePendingPersistence = (): Promise<void> => {
  const pending = pendingPersistence;
  pendingPersistence = null;
  persistenceTimer = null;
  if (pending !== null) {
    persistenceQueue = persistenceQueue
      .then(async () => {
        const contents = typeof pending === "function" ? pending() : pending;
        validateDocument(contents);
        await invoke("persist_document", { request: { contents } });
      })
      .catch(() => {
        // Native errors and serialization failures can contain document data.
        console.error("Failed to persist desktop document.");
      });
  }
  return persistenceQueue;
};

export const restoreDesktopDocument = async () => {
  if (!isDesktop()) {
    return null;
  }
  const contents = await invoke<string | null>("restore_document");
  if (contents === null) {
    return null;
  }
  validateDocument(contents);
  return loadFromBlob(
    new Blob([contents], { type: MIME_TYPES.json }),
    null,
    null,
  );
};

/** Prefer a lazy serializer so browser calls and superseded edits do no work. */
export const persistDesktopDocument = (
  contents: string | (() => string),
): void => {
  if (!isDesktop()) {
    return;
  }
  pendingPersistence = contents;
  if (persistenceTimer !== null) {
    window.clearTimeout(persistenceTimer);
  }
  persistenceTimer = window.setTimeout(writePendingPersistence, 300);
};

/** Wait for the pending edit and all writes queued before this call to settle. */
export const flushDesktopDocument = (): Promise<void> => {
  if (persistenceTimer !== null) {
    window.clearTimeout(persistenceTimer);
  }
  return writePendingPersistence();
};

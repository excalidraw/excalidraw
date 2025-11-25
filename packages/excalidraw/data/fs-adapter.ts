/**
 * Adapter for browser-fs-access@0.38.0
 *
 * Provides cancel-safe file operations that return `null` on user cancel
 * instead of throwing AbortError. Handles both modern File System Access API
 * and legacy <input type="file"> fallback with cancel detection.
 *
 * Key behaviors:
 * - User cancel returns `null` instead of throwing
 * - Modern browsers: Uses File System Access API with AbortError handling
 * - Legacy browsers: Uses <input> with focus-based cancel detection
 * - Preserves multiple file selection support with proper typing
 */

import {
  fileOpen as _fileOpen,
  fileSave as _fileSave,
  type FileWithHandle,
  type FileSystemHandle,
} from "browser-fs-access";

import { EVENT, debounce } from "@excalidraw/common";
import { AbortError } from "../errors";

const INPUT_CHANGE_INTERVAL_MS = 5000;

/**
 * Type guard to check if a handle is a file handle (not a directory handle)
 */
export const isFileSystemFileHandle = (
  handle: unknown,
): handle is FileSystemHandle => {
  return (
    typeof handle === "object" &&
    handle !== null &&
    "kind" in handle &&
    (handle as { kind: string }).kind === "file"
  );
};

/**
 * Opens file(s) from disk with cancel-safe behavior.
 *
 * @returns Files selected by user, or `null` if canceled
 * @throws Only non-cancel errors (permission denied, etc.)
 *
 * Modern browsers: Uses showOpenFilePicker with AbortError → null mapping
 * Legacy browsers: Uses <input type="file"> with focus-based cancel detection
 */
export const openFileSafe = async <M extends boolean | undefined = false>(
  options?: {
    description?: string;
    extensions?: string[];
    mimeTypes?: string[];
    multiple?: M;
    excludeAcceptAllOption?: boolean;
  },
): Promise<M extends false | undefined ? FileWithHandle | null : FileWithHandle[] | null> => {
  type RetType = M extends false | undefined
    ? FileWithHandle | null
    : FileWithHandle[] | null;

  try {
    // Check if modern File System Access API is available
    const hasNativeSupport =
      "showOpenFilePicker" in window &&
      typeof (window as any).showOpenFilePicker === "function";

    if (hasNativeSupport) {
      // Modern path: use browser-fs-access which will use showOpenFilePicker
      // On cancel, it throws DOMException with name "AbortError"
      const result = await _fileOpen(options);
      return result as RetType;
    }

    // Legacy path: implement cancel detection using <input type="file">
    // This mimics the behavior that was in legacySetup before 0.38.0
    return await new Promise<RetType>((resolve, reject) => {
      const input = document.createElement("input");
      input.type = "file";
      input.multiple = options?.multiple ?? false;

      if (options?.extensions?.length) {
        input.accept = options.extensions.join(",");
      } else if (options?.mimeTypes?.length) {
        input.accept = options.mimeTypes.join(",");
      }

      const scheduleRejection = debounce(() => {
        reject(new AbortError());
      }, INPUT_CHANGE_INTERVAL_MS);

      const checkForFile = () => {
        if (input.files?.length) {
          const files = Array.from(input.files).map((file) => {
            // Add empty handle property to match FileWithHandle type
            return Object.assign(file, { handle: undefined });
          });
          const result = options?.multiple ? files : files[0];
          resolve(result as RetType);
        }
      };

      const focusHandler = () => {
        checkForFile();
        document.addEventListener(EVENT.KEYUP, scheduleRejection);
        document.addEventListener(EVENT.POINTER_UP, scheduleRejection);
        scheduleRejection();
      };

      // Set up cancel detection
      requestAnimationFrame(() => {
        window.addEventListener(EVENT.FOCUS, focusHandler);
      });

      const interval = window.setInterval(() => {
        checkForFile();
      }, INPUT_CHANGE_INTERVAL_MS);

      // Cleanup function
      const cleanup = (rejectPromise?: boolean) => {
        clearInterval(interval);
        scheduleRejection.cancel();
        window.removeEventListener(EVENT.FOCUS, focusHandler);
        document.removeEventListener(EVENT.KEYUP, scheduleRejection);
        document.removeEventListener(EVENT.POINTER_UP, scheduleRejection);

        if (rejectPromise) {
          console.warn("Opening the file was canceled (legacy-fs).");
          reject(new AbortError());
        }
      };

      // Handle file selection
      input.addEventListener("change", () => {
        cleanup(false);
        checkForFile();
      });

      // Handle cancel (user closes dialog without selecting)
      input.addEventListener("cancel", () => {
        cleanup(true);
      });

      // Trigger the file picker
      input.click();
    });
  } catch (error) {
    // Map AbortError to null (user cancel)
    if (
      error instanceof Error &&
      (error.name === "AbortError" || error instanceof AbortError)
    ) {
      return null as RetType;
    }
    // Re-throw other errors (permission denied, etc.)
    throw error;
  }
};

/**
 * Saves a file to disk with cancel-safe behavior.
 *
 * @param blob - Data to save
 * @param options - File options (name, extensions, etc.)
 * @param existingHandle - Optional file handle to save to existing file
 * @returns FileSystemHandle if saved, or `null` if canceled
 * @throws Only non-cancel errors
 *
 * Uses browser-fs-access fileSave which still has legacySetup support in 0.38.0
 */
export const saveFileSafe = async (
  blob: Blob | Promise<Blob>,
  options?: {
    fileName?: string;
    extensions?: string[];
    mimeTypes?: string[];
    description?: string;
    excludeAcceptAllOption?: boolean;
  },
  existingHandle?: FileSystemHandle | null,
  throwIfExistingHandleNotGood?: boolean,
): Promise<FileSystemHandle | null> => {
  try {
    // Cast to FileSystemFileHandle as that's what the library expects in 0.38.0
    // FileSystemFileHandle extends FileSystemHandle with kind: "file"
    const handle = await _fileSave(
      blob,
      options,
      existingHandle as any,
      throwIfExistingHandleNotGood,
    );
    return handle as FileSystemHandle | null;
  } catch (error) {
    // Map AbortError to null (user cancel)
    if (
      error instanceof Error &&
      (error.name === "AbortError" || error instanceof AbortError)
    ) {
      return null;
    }
    // Re-throw other errors
    throw error;
  }
};

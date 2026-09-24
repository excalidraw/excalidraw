import { MIME_TYPES } from "@excalidraw/common";
import { serializeAsJSON } from "@excalidraw/excalidraw/data/json";
import { loadFromBlob } from "@excalidraw/excalidraw/data/blob";
import { nativeFileSystemSupported } from "@excalidraw/excalidraw/data/filesystem";

import type { ExcalidrawElement } from "@excalidraw/element/types";
import type { AppState, BinaryFiles } from "@excalidraw/excalidraw/types";
import type { ImportedDataState } from "@excalidraw/excalidraw/data/types";

export const isCollectionsFileSystemSupported = (): boolean => {
  return (
    nativeFileSystemSupported &&
    typeof window.showDirectoryPicker === "function"
  );
};

export const getAutosaveFileName = (fileName: string): string => {
  if (fileName.endsWith(".excalidraw")) {
    return fileName.replace(/\.excalidraw$/, ".autosave.excalidraw");
  }
  return `${fileName}.autosave.excalidraw`;
};

export const sanitizeCollectionFileName = (name: string): string => {
  const withoutInvalidChars = name
    .split("")
    .map((char) => (char.charCodeAt(0) < 32 ? "_" : char))
    .join("")
    .replace(/[<>:"/\\|?*]/g, "_")
    .trim();
  return withoutInvalidChars || "Untitled";
};

export const verifyHandlePermission = async (
  handle: FileSystemHandle,
  mode: FileSystemHandlePermissionDescriptor["mode"] = "readwrite",
): Promise<boolean> => {
  if (!handle.queryPermission) {
    return true;
  }
  const options: FileSystemHandlePermissionDescriptor = { mode };
  if ((await handle.queryPermission(options)) === "granted") {
    return true;
  }
  if (handle.requestPermission) {
    return (await handle.requestPermission(options)) === "granted";
  }
  return false;
};

export const requestDirectoryHandle =
  async (): Promise<FileSystemDirectoryHandle> => {
    if (!isCollectionsFileSystemSupported()) {
      throw new Error("Folder picker is not supported in this browser.");
    }
    try {
      return await window.showDirectoryPicker!({ mode: "readwrite" });
    } catch (error: any) {
      if (error?.name === "AbortError") {
        throw new Error("Folder selection was cancelled.");
      }
      throw error;
    }
  };

export const requestSaveFileHandle = async (
  suggestedName: string,
): Promise<FileSystemFileHandle> => {
  if (!isCollectionsFileSystemSupported()) {
    throw new Error("Save As is not supported in this browser.");
  }
  try {
    return await window.showSaveFilePicker!({
      suggestedName,
      types: [
        {
          description: "Excalidraw file",
          accept: { [MIME_TYPES.excalidraw]: [".excalidraw"] },
        },
      ],
    });
  } catch (error: any) {
    if (error?.name === "AbortError") {
      throw new Error("Save was cancelled.");
    }
    throw error;
  }
};

export const getOrCreateFileHandle = async (
  directoryHandle: FileSystemDirectoryHandle,
  fileName: string,
): Promise<FileSystemFileHandle> => {
  try {
    return await directoryHandle.getFileHandle(fileName, { create: true });
  } catch {
    return directoryHandle.getFileHandle(fileName);
  }
};

export const writeSerializedToFileHandle = async (
  fileHandle: FileSystemFileHandle,
  serialized: string,
): Promise<void> => {
  const hasPermission = await verifyHandlePermission(fileHandle, "readwrite");
  if (!hasPermission) {
    throw new Error("Permission denied to save collection file.");
  }

  const writable = await fileHandle.createWritable();
  await writable.write(new Blob([serialized], { type: MIME_TYPES.excalidraw }));
  await writable.close();
};

export const writeSceneToFileHandle = async (
  fileHandle: FileSystemFileHandle,
  elements: readonly ExcalidrawElement[],
  appState: AppState,
  files: BinaryFiles,
): Promise<string> => {
  const serialized = serializeAsJSON(elements, appState, files, "local");
  await writeSerializedToFileHandle(fileHandle, serialized);
  return serialized;
};

export const writeAutosaveBackup = async (
  directoryHandle: FileSystemDirectoryHandle,
  fileName: string,
  serialized: string,
): Promise<void> => {
  const autosaveName = getAutosaveFileName(fileName);
  try {
    const handle = await getOrCreateFileHandle(directoryHandle, autosaveName);
    await writeSerializedToFileHandle(handle, serialized);
  } catch (error) {
    console.error("Autosave backup failed", error);
  }
};

export const readSceneFromFileHandle = async (
  fileHandle: FileSystemFileHandle,
  localAppState: AppState | null,
  localElements: readonly ExcalidrawElement[] | null,
): Promise<ImportedDataState> => {
  const hasPermission = await verifyHandlePermission(fileHandle, "read");
  if (!hasPermission) {
    throw new Error("Permission denied to read collection file.");
  }

  const file = await fileHandle.getFile();
  return loadFromBlob(file, localAppState, localElements, fileHandle);
};

export const tryReadSceneFromDirectoryFile = async (
  directoryHandle: FileSystemDirectoryHandle,
  fileName: string,
  localAppState: AppState | null,
  localElements: readonly ExcalidrawElement[] | null,
): Promise<ImportedDataState | null> => {
  try {
    const handle = await directoryHandle.getFileHandle(fileName);
    return await readSceneFromFileHandle(handle, localAppState, localElements);
  } catch {
    return null;
  }
};

export const downloadSceneAsFile = (
  fileName: string,
  elements: readonly ExcalidrawElement[],
  appState: AppState,
  files: BinaryFiles,
): void => {
  const serialized = serializeAsJSON(elements, appState, files, "local");
  const blob = new Blob([serialized], { type: MIME_TYPES.excalidraw });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName.endsWith(".excalidraw")
    ? fileName
    : `${fileName}.excalidraw`;
  anchor.click();
  URL.revokeObjectURL(url);
};

export const serializeScene = (
  elements: readonly ExcalidrawElement[],
  appState: AppState,
  files: BinaryFiles,
): string => serializeAsJSON(elements, appState, files, "local");

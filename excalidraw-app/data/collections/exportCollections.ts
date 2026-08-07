import JSZip from "jszip";

import type { AppState } from "@excalidraw/excalidraw/types";

import { CollectionStore } from "./CollectionStore";
import { serializeScene } from "./collectionFiles";

const downloadBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
};

export const exportAllCollectionsToZip = async (
  fallbackAppState: AppState,
  onProgress?: (current: number, total: number, name: string) => void,
): Promise<{ failed: string[] }> => {
  const collections = CollectionStore.getCollections();
  const zip = new JSZip();
  const failed: string[] = [];

  for (let i = 0; i < collections.length; i++) {
    const collection = collections[i];
    onProgress?.(i + 1, collections.length, collection.name);

    try {
      const scene = await CollectionStore.loadCollectionScene(
        collection.id,
        fallbackAppState,
        null,
      );
      if (!scene?.elements) {
        failed.push(collection.name);
        continue;
      }
      const appState = {
        ...fallbackAppState,
        ...(scene.appState ?? {}),
      } as AppState;
      const json = serializeScene(scene.elements, appState, scene.files ?? {});
      zip.file(collection.fileName, json);
    } catch {
      failed.push(collection.name);
    }
  }

  const blob = await zip.generateAsync({ type: "blob" });
  const date = new Date().toISOString().slice(0, 10);
  downloadBlob(blob, `excalidraw-collections-${date}.zip`);

  return { failed };
};

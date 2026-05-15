import { exportToBlob, MIME_TYPES } from "@excalidraw/excalidraw";

import { createStore, get, set } from "idb-keyval";

import type { ExcalidrawElement } from "@excalidraw/element/types";
import type { AppState, BinaryFiles } from "@excalidraw/excalidraw/types";

import { STORAGE_KEYS } from "../../app_constants";

const collectionsStore = createStore(
  `${STORAGE_KEYS.IDB_COLLECTIONS}-db`,
  `${STORAGE_KEYS.IDB_COLLECTIONS}-store`,
);

const thumbnailKey = (collectionId: string) => `thumbnail-${collectionId}`;

export const saveCollectionThumbnail = async (
  collectionId: string,
  elements: readonly ExcalidrawElement[],
  appState: AppState,
  files: BinaryFiles,
): Promise<void> => {
  const visible = elements.filter((el) => !el.isDeleted);
  if (visible.length === 0) {
    return;
  }

  try {
    const blob = await exportToBlob({
      elements: visible,
      appState: {
        ...appState,
        exportBackground: true,
        viewBackgroundColor: appState.viewBackgroundColor,
      },
      files,
      mimeType: MIME_TYPES.png,
      exportPadding: 10,
      maxWidthOrHeight: 200,
    });
    await set(thumbnailKey(collectionId), blob, collectionsStore);
  } catch (error) {
    console.error("Thumbnail generation failed", error);
  }
};

export const getCollectionThumbnail = async (
  collectionId: string,
): Promise<Blob | undefined> => {
  return get<Blob>(thumbnailKey(collectionId), collectionsStore);
};

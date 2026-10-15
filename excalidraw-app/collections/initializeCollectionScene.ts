import {
  restoreAppState,
  restoreElements,
} from "@excalidraw/excalidraw/data/restore";

import type { ExcalidrawElement } from "@excalidraw/element/types";
import type { RestoredDataState } from "@excalidraw/excalidraw/data/restore";
import type { AppState, BinaryFiles } from "@excalidraw/excalidraw/types";

import { CollectionStore } from "../data/collections/CollectionStore";

export const RECOVERED_FROM_AUTOSAVE_SESSION_KEY =
  "excalidraw-recovered-from-autosave";

export type CollectionSceneInput = Omit<RestoredDataState, "files"> & {
  scrollToContent?: boolean;
  files?: BinaryFiles;
};

export const applyActiveCollectionToInitialScene = async (
  scene: CollectionSceneInput,
  localElements: readonly ExcalidrawElement[] | null | undefined,
  localAppState: Partial<AppState> | null | undefined,
): Promise<CollectionSceneInput> => {
  CollectionStore.ensureActiveCollectionOnStartup();
  const activeCollection = CollectionStore.getActiveCollection();
  if (!activeCollection) {
    return scene;
  }

  try {
    const collectionScene = await CollectionStore.loadActiveCollectionScene(
      null,
      localElements ?? null,
    );
    if (!collectionScene?.elements) {
      return scene;
    }

    const next: CollectionSceneInput = {
      elements: restoreElements(collectionScene.elements, null, {
        repairBindings: true,
        deleteInvisibleElements: true,
      }),
      appState: restoreAppState(
        collectionScene.appState,
        localAppState ?? null,
      ),
      files: collectionScene.files,
    };

    if (collectionScene.recoveredFromAutosave) {
      try {
        sessionStorage.setItem(RECOVERED_FROM_AUTOSAVE_SESSION_KEY, "1");
      } catch {
        /* ignore */
      }
    }

    return next;
  } catch (error) {
    console.error(error);
    return scene;
  }
};

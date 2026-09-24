import { CaptureUpdateAction } from "@excalidraw/excalidraw";
import {
  restoreAppState,
  restoreElements,
} from "@excalidraw/excalidraw/data/restore";
import { useCallback, useEffect, useRef } from "react";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type { AppState } from "@excalidraw/excalidraw/types";

import { useAtomValue, useSetAtom } from "../app-jotai";

import {
  activeCollectionDirtyAtom,
  activeSaveLocationAtom,
  recoveredFromAutosaveAtom,
} from "../data/collectionUiAtoms";
import { CollectionStore } from "../data/collections/CollectionStore";
import { computeSceneSnapshot } from "../data/collections/sceneSnapshot";
import { LocalData } from "../data/LocalData";
import {
  lastSavedAtAtom,
  saveErrorMessageAtom,
  saveStatusAtom,
} from "../data/saveStatusAtoms";

import { RECOVERED_FROM_AUTOSAVE_SESSION_KEY } from "./initializeCollectionScene";

import type { CollabAPI } from "../collab/Collab";

export type UseCollectionsAppIntegrationArgs = {
  excalidrawAPI: ExcalidrawImperativeAPI | null;
  collabAPI: CollabAPI | null;
  setErrorMessage: (message: string) => void;
};

export const useCollectionsAppIntegration = ({
  excalidrawAPI,
  collabAPI,
  setErrorMessage,
}: UseCollectionsAppIntegrationArgs) => {
  const setSaveStatus = useSetAtom(saveStatusAtom);
  const setLastSavedAt = useSetAtom(lastSavedAtAtom);
  const setSaveErrorMessage = useSetAtom(saveErrorMessageAtom);
  const setActiveCollectionDirty = useSetAtom(activeCollectionDirtyAtom);
  const setActiveSaveLocation = useSetAtom(activeSaveLocationAtom);
  const setRecoveredFromAutosave = useSetAtom(recoveredFromAutosaveAtom);
  const isCollectionDirty = useAtomValue(activeCollectionDirtyAtom);

  const lastPersistedSnapshotRef = useRef<string | null>(null);

  const syncPersistedSnapshot = useCallback(() => {
    if (!excalidrawAPI) {
      return;
    }
    const snapshot = computeSceneSnapshot(
      excalidrawAPI.getSceneElementsIncludingDeleted(),
      excalidrawAPI.getFiles(),
    );
    lastPersistedSnapshotRef.current = snapshot;
    setActiveCollectionDirty(false);
  }, [excalidrawAPI, setActiveCollectionDirty]);

  const updateDirtyState = useCallback(() => {
    if (!excalidrawAPI || collabAPI?.isCollaborating()) {
      return;
    }
    if (!CollectionStore.getActiveCollection()) {
      setActiveCollectionDirty(false);
      return;
    }
    const snapshot = computeSceneSnapshot(
      excalidrawAPI.getSceneElementsIncludingDeleted(),
      excalidrawAPI.getFiles(),
    );
    const baseline = lastPersistedSnapshotRef.current;
    setActiveCollectionDirty(!!baseline && snapshot !== baseline);
  }, [excalidrawAPI, collabAPI, setActiveCollectionDirty]);

  useEffect(() => {
    if (!excalidrawAPI) {
      return;
    }
    const active = CollectionStore.getActiveCollection();
    if (active) {
      setActiveSaveLocation(active.saveLocationLabel ?? null);
      syncPersistedSnapshot();
    }
    try {
      if (sessionStorage.getItem(RECOVERED_FROM_AUTOSAVE_SESSION_KEY)) {
        sessionStorage.removeItem(RECOVERED_FROM_AUTOSAVE_SESSION_KEY);
        setRecoveredFromAutosave(true);
        setErrorMessage(
          "Recovered from autosave backup. Save to confirm this version on disk.",
        );
      }
    } catch {
      /* ignore */
    }
  }, [
    excalidrawAPI,
    setActiveSaveLocation,
    syncPersistedSnapshot,
    setRecoveredFromAutosave,
    setErrorMessage,
  ]);

  useEffect(() => {
    LocalData.onSaveStart = () => {
      setSaveErrorMessage(null);
      setSaveStatus("saving");
    };
    LocalData.onSaveComplete = () => {
      setSaveStatus("saved");
      setLastSavedAt(Date.now());
    };
    return () => {
      LocalData.onSaveStart = null;
      LocalData.onSaveComplete = null;
    };
  }, [setSaveStatus, setLastSavedAt, setSaveErrorMessage]);

  const persistActiveCollection = useCallback(async () => {
    if (!excalidrawAPI || collabAPI?.isCollaborating()) {
      return;
    }
    if (!CollectionStore.getActiveCollection()) {
      return;
    }
    try {
      await CollectionStore.saveActiveToFile(
        excalidrawAPI.getSceneElementsIncludingDeleted(),
        excalidrawAPI.getAppState(),
        excalidrawAPI.getFiles(),
      );
      syncPersistedSnapshot();
    } catch (error: any) {
      setSaveStatus("error");
      setSaveErrorMessage(error?.message ?? "Could not save collection file.");
    }
  }, [
    excalidrawAPI,
    collabAPI,
    setSaveStatus,
    setSaveErrorMessage,
    syncPersistedSnapshot,
  ]);

  const getSceneForCollection = useCallback(
    async (collectionId: string) => {
      if (!excalidrawAPI) {
        throw new Error("Canvas is still loading. Try again in a moment.");
      }
      const active = CollectionStore.getActiveCollection();
      if (active?.id === collectionId) {
        return {
          elements: excalidrawAPI.getSceneElementsIncludingDeleted(),
          appState: excalidrawAPI.getAppState(),
          files: excalidrawAPI.getFiles(),
        };
      }
      const scene = await CollectionStore.loadCollectionScene(
        collectionId,
        null,
        null,
      );
      if (!scene) {
        throw new Error("Collection has no data.");
      }
      return {
        elements: scene.elements ?? [],
        appState: {
          ...excalidrawAPI.getAppState(),
          ...(scene.appState ?? {}),
        } as AppState,
        files: scene.files ?? {},
      };
    },
    [excalidrawAPI],
  );

  const saveCollectionToDisk = useCallback(
    async (collectionId: string) => {
      setSaveErrorMessage(null);

      try {
        if (CollectionStore.isFileSystemSupported()) {
          await CollectionStore.ensureSessionDirectory();
        }

        LocalData.flushSave();

        const { elements, appState, files } = await getSceneForCollection(
          collectionId,
        );
        const active = CollectionStore.getActiveCollection();

        await CollectionStore.saveCollectionToDisk(
          collectionId,
          elements,
          appState,
          files,
        );

        const saved = CollectionStore.getCollections().find(
          (c) => c.id === collectionId,
        );
        if (saved?.saveLocationLabel) {
          setActiveSaveLocation(saved.saveLocationLabel);
        }
        if (active?.id === collectionId) {
          syncPersistedSnapshot();
        }
        setRecoveredFromAutosave(false);
        setSaveStatus("saved");
        setLastSavedAt(Date.now());
      } catch (error: any) {
        setSaveStatus("error");
        setSaveErrorMessage(
          error?.message ?? "Could not save collection file.",
        );
        throw error;
      }
    },
    [
      getSceneForCollection,
      setSaveStatus,
      setLastSavedAt,
      setSaveErrorMessage,
      setActiveSaveLocation,
      syncPersistedSnapshot,
      setRecoveredFromAutosave,
    ],
  );

  const saveCollectionAs = useCallback(
    async (collectionId: string) => {
      setSaveErrorMessage(null);
      LocalData.flushSave();

      const { elements, appState, files } = await getSceneForCollection(
        collectionId,
      );
      const active = CollectionStore.getActiveCollection();

      await CollectionStore.saveCollectionAs(
        collectionId,
        elements,
        appState,
        files,
      );

      const saved = CollectionStore.getCollections().find(
        (c) => c.id === collectionId,
      );
      if (saved?.saveLocationLabel) {
        setActiveSaveLocation(saved.saveLocationLabel);
      }
      if (active?.id === collectionId) {
        syncPersistedSnapshot();
      }
      setSaveStatus("saved");
      setLastSavedAt(Date.now());
    },
    [
      getSceneForCollection,
      setSaveStatus,
      setLastSavedAt,
      setSaveErrorMessage,
      setActiveSaveLocation,
      syncPersistedSnapshot,
    ],
  );

  const downloadCollection = useCallback(
    async (collectionId: string) => {
      if (!excalidrawAPI) {
        return;
      }
      const { elements, appState, files } = await getSceneForCollection(
        collectionId,
      );
      CollectionStore.downloadCollection(
        collectionId,
        elements,
        appState,
        files,
      );
    },
    [excalidrawAPI, getSceneForCollection],
  );

  const saveActiveCollection = useCallback(async () => {
    const active = CollectionStore.getActiveCollection();
    if (!active) {
      return;
    }
    await saveCollectionToDisk(active.id);
  }, [saveCollectionToDisk]);

  const switchCollection = useCallback(
    async (collectionId: string) => {
      if (!excalidrawAPI) {
        return;
      }

      LocalData.flushSave();

      const active = CollectionStore.getActiveCollection();
      if (active && active.id !== collectionId) {
        await CollectionStore.saveCollectionToStorage(
          active.id,
          excalidrawAPI.getSceneElementsIncludingDeleted(),
          excalidrawAPI.getAppState(),
          excalidrawAPI.getFiles(),
        );
      }

      CollectionStore.setActiveCollection(collectionId);

      const collectionScene = await CollectionStore.loadCollectionScene(
        collectionId,
        excalidrawAPI.getAppState(),
        excalidrawAPI.getSceneElementsIncludingDeleted(),
      );

      if (collectionScene) {
        excalidrawAPI.updateScene({
          elements: restoreElements(collectionScene.elements ?? [], null, {
            repairBindings: true,
            deleteInvisibleElements: true,
          }),
          appState: restoreAppState(
            collectionScene.appState,
            excalidrawAPI.getAppState(),
          ),
          captureUpdate: CaptureUpdateAction.IMMEDIATELY,
        });
        if (collectionScene.files) {
          excalidrawAPI.addFiles(Object.values(collectionScene.files));
        }
      } else {
        excalidrawAPI.resetScene();
      }

      const switched = CollectionStore.getActiveCollection();
      setActiveSaveLocation(switched?.saveLocationLabel ?? null);
      syncPersistedSnapshot();
      setRecoveredFromAutosave(false);
    },
    [
      excalidrawAPI,
      setActiveSaveLocation,
      syncPersistedSnapshot,
      setRecoveredFromAutosave,
    ],
  );

  const openCollectionById = useCallback(
    async (collectionId: string) => {
      await switchCollection(collectionId);
    },
    [switchCollection],
  );

  const afterLocalSave = useCallback(() => {
    const activeCollection = CollectionStore.getActiveCollection();
    if (activeCollection?.savedToDisk) {
      void persistActiveCollection();
    }
    updateDirtyState();
  }, [persistActiveCollection, updateDirtyState]);

  const flushActiveCollectionOnUnload = useCallback(() => {
    if (
      !excalidrawAPI ||
      collabAPI?.isCollaborating() ||
      !CollectionStore.getActiveCollection()?.savedToDisk
    ) {
      return;
    }
    void CollectionStore.saveActiveToFile(
      excalidrawAPI.getSceneElementsIncludingDeleted(),
      excalidrawAPI.getAppState(),
      excalidrawAPI.getFiles(),
    );
  }, [excalidrawAPI, collabAPI]);

  return {
    isCollectionDirty,
    saveCollectionToDisk,
    saveCollectionAs,
    downloadCollection,
    saveActiveCollection,
    switchCollection,
    openCollectionById,
    afterLocalSave,
    updateDirtyState,
    flushActiveCollectionOnUnload,
  };
};

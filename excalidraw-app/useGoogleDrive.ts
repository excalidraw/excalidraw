import { useCallback, useEffect, useRef } from "react";

import { CaptureUpdateAction, MIME_TYPES } from "@excalidraw/excalidraw";
import { openConfirmModal } from "@excalidraw/excalidraw/components/OverwriteConfirm/OverwriteConfirmState";
import { loadFromBlob } from "@excalidraw/excalidraw/data/blob";
import { serializeAsJSON } from "@excalidraw/excalidraw/data/json";
import { t } from "@excalidraw/excalidraw/i18n";

import type { RestoredDataState } from "@excalidraw/excalidraw/data/restore";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { STORAGE_KEYS } from "./app_constants";
import { useAtom } from "./app-jotai";
import {
  createDriveFile,
  downloadDriveFile,
  driveFileAtom,
  getGoogleDriveAuth,
  isGoogleDriveConfigured,
  pickDriveFile,
  pickDriveFolder,
  updateDriveFile,
} from "./data/googleDrive";

import type { RefObject } from "react";

import type { DriveFile } from "./data/googleDrive";

const stripExtension = (name: string) => name.replace(/\.excalidraw$/i, "");

const ensureExtension = (name: string) =>
  /\.excalidraw$/i.test(name) ? name : `${name}.excalidraw`;

const readStoredDriveFile = (): DriveFile | null => {
  try {
    const raw = localStorage.getItem(
      STORAGE_KEYS.LOCAL_STORAGE_GOOGLE_DRIVE_FILE,
    );
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    return parsed?.id && parsed?.name
      ? { id: parsed.id, name: parsed.name }
      : null;
  } catch (error) {
    console.error(error);
    return null;
  }
};

const writeStoredDriveFile = (file: DriveFile | null) => {
  try {
    if (file) {
      localStorage.setItem(
        STORAGE_KEYS.LOCAL_STORAGE_GOOGLE_DRIVE_FILE,
        JSON.stringify(file),
      );
    } else {
      localStorage.removeItem(STORAGE_KEYS.LOCAL_STORAGE_GOOGLE_DRIVE_FILE);
    }
  } catch (error) {
    console.error(error);
  }
};

/**
 * Optional client-side Google Drive integration.
 *
 * - `onOpenFromCloud` is handed to `<Excalidraw>` and surfaces as the
 *   "Open from cloud" menu item.
 * - `saveToDrive` is called by the "Save to Google Drive" card in the
 *   "Save to..." dialog.
 * - `clearDriveFile` drops the association with the current Drive file (e.g.
 *   when a different document is loaded) so we never overwrite the wrong file.
 *
 * All are `undefined` when the Google credentials aren't configured.
 */
export const useGoogleDrive = (
  excalidrawAPI: ExcalidrawImperativeAPI | null,
  containerRef: RefObject<HTMLElement | null>,
) => {
  const [driveFile, setDriveFile] = useAtom(driveFileAtom);
  const busyRef = useRef(false);

  // restore the association persisted alongside the local scene
  useEffect(() => {
    const stored = readStoredDriveFile();
    if (stored) {
      setDriveFile(stored);
    }
  }, [setDriveFile]);

  const setDriveFilePersisted = useCallback(
    (file: DriveFile | null) => {
      setDriveFile(file);
      writeStoredDriveFile(file);
    },
    [setDriveFile],
  );

  const clearDriveFile = useCallback(() => {
    setDriveFilePersisted(null);
  }, [setDriveFilePersisted]);

  const getOwner = useCallback(() => {
    const container = containerRef.current;
    const ownerDocument = container?.ownerDocument ?? document;
    const ownerWindow = ownerDocument.defaultView ?? window;
    return { ownerDocument, ownerWindow };
  }, [containerRef]);

  // warm up Google Identity Services so the OAuth token request can run
  // within the user gesture that triggered the save
  useEffect(() => {
    if (!isGoogleDriveConfigured()) {
      return;
    }
    const { ownerDocument, ownerWindow } = getOwner();
    getGoogleDriveAuth(ownerDocument, ownerWindow)
      .prepare()
      .catch((error) => {
        console.error(error);
      });
  }, [getOwner]);

  const onOpenFromCloud = useCallback(async () => {
    if (!excalidrawAPI || busyRef.current) {
      return;
    }
    busyRef.current = true;
    try {
      const { ownerDocument, ownerWindow } = getOwner();
      const auth = getGoogleDriveAuth(ownerDocument, ownerWindow);
      const accessToken = await auth.getToken();
      const picked = await pickDriveFile({
        ownerDocument,
        ownerWindow,
        accessToken,
      });
      if (!picked) {
        return;
      }

      if (
        excalidrawAPI.getSceneElements().length &&
        !(await openConfirmModal({
          title: t("googleDrive.openConfirmTitle"),
          description: t("googleDrive.openConfirmDescription"),
          actionLabel: t("googleDrive.openConfirmButton"),
          color: "warning",
        }))
      ) {
        return;
      }

      const blob = await downloadDriveFile({
        ownerWindow,
        accessToken,
        fileId: picked.id,
      });

      const data = (await loadFromBlob(
        blob,
        excalidrawAPI.getAppState(),
        null,
        null,
      )) as RestoredDataState;

      excalidrawAPI.updateScene({
        elements: data.elements,
        appState: {
          ...data.appState,
          name: stripExtension(picked.name),
        },
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });

      const files = Object.values(data.files ?? {});
      if (files.length) {
        excalidrawAPI.addFiles(files);
      }

      setDriveFilePersisted({ id: picked.id, name: picked.name });
      excalidrawAPI.setToast({
        message: t("googleDrive.openSuccessToast", { fileName: picked.name }),
        duration: 3000,
      });
    } catch (error) {
      console.error(error);
      excalidrawAPI.setToast({
        message: (error as Error)?.message || t("googleDrive.openError"),
        duration: 3000,
      });
    } finally {
      busyRef.current = false;
    }
  }, [excalidrawAPI, getOwner, setDriveFilePersisted]);

  const saveToDrive = useCallback(
    async ({
      name: nameOverride,
      onStart,
      onSettled,
    }: {
      name?: string;
      /** lifecycle events so callers can show/clear an in-progress indicator
       * without the save operation owning any presentation itself */
      onStart?: () => void;
      onSettled?: () => void;
    } = {}): Promise<DriveFile> => {
      if (!excalidrawAPI) {
        throw new Error(t("googleDrive.saveError"));
      }
      // guard against concurrent saves (double-click / save while opening)
      if (busyRef.current) {
        throw new DOMException("Save already in progress", "AbortError");
      }
      busyRef.current = true;
      try {
        onStart?.();

        const elements = excalidrawAPI.getSceneElements();
        if (!elements.length) {
          throw new Error(t("googleDrive.saveEmptyError"));
        }

        const { ownerDocument, ownerWindow } = getOwner();
        const auth = getGoogleDriveAuth(ownerDocument, ownerWindow);
        const accessToken = await auth.getToken();

        const name = ensureExtension(
          nameOverride?.trim() || driveFile?.name || excalidrawAPI.getName(),
        );
        const serialized = serializeAsJSON(
          elements,
          excalidrawAPI.getAppState(),
          excalidrawAPI.getFiles(),
          "local",
        );
        const blob = new Blob([serialized], { type: MIME_TYPES.excalidraw });

        const saved: DriveFile = driveFile
          ? await updateDriveFile({
              ownerWindow,
              accessToken,
              fileId: driveFile.id,
              blob,
              name,
            })
          : await (async () => {
              const folder = await pickDriveFolder({
                ownerDocument,
                ownerWindow,
                accessToken,
              });
              if (!folder) {
                throw new DOMException("Save cancelled", "AbortError");
              }
              return createDriveFile({
                ownerWindow,
                accessToken,
                name,
                blob,
                parentId: folder.id,
              });
            })();

        const savedFile = { id: saved.id, name: saved.name ?? name };
        setDriveFilePersisted(savedFile);
        return savedFile;
      } finally {
        onSettled?.();
        busyRef.current = false;
      }
    },
    [excalidrawAPI, driveFile, getOwner, setDriveFilePersisted],
  );

  if (!isGoogleDriveConfigured()) {
    return {
      onOpenFromCloud: undefined,
      saveToDrive: undefined,
      clearDriveFile: undefined,
      driveFile: null as DriveFile | null,
    };
  }

  return { onOpenFromCloud, saveToDrive, clearDriveFile, driveFile };
};

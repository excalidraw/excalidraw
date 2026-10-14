/**
 * Thin wrapper around the Google Picker API for picking a single Drive file.
 *
 * The Picker both lets the user browse Drive and grants the app `drive.file`
 * access to the picked file, which is required to later read/update it.
 */

import { t } from "@excalidraw/excalidraw/i18n";

import { MIME_TYPES } from "@excalidraw/common";

import { getGoogleApiKey, getGoogleAppId } from "./auth";
import { loadScript } from "./utils";

import type { DriveFile, PickedDriveFile } from "./types";

const GAPI_SRC = "https://apis.google.com/js/api.js";

let pickerLoader: Promise<void> | null = null;

const loadPicker = (
  ownerDocument: Document,
  ownerWindow: Window & typeof globalThis,
): Promise<void> => {
  if (pickerLoader) {
    return pickerLoader;
  }

  pickerLoader = (async () => {
    await loadScript(ownerDocument, GAPI_SRC);
    const gapi = (ownerWindow as any).gapi;
    if (!gapi) {
      throw new Error("Google API loader failed to load");
    }
    await new Promise<void>((resolve, reject) => {
      gapi.load("picker", {
        callback: () => resolve(),
        onerror: () => reject(new Error("Failed to load Google Picker")),
      });
    });
  })().catch((error) => {
    // allow retrying the load on a subsequent attempt
    pickerLoader = null;
    throw error;
  });

  return pickerLoader;
};

export const pickDriveFile = async ({
  ownerDocument,
  ownerWindow,
  accessToken,
}: {
  ownerDocument: Document;
  ownerWindow: Window & typeof globalThis;
  accessToken: string;
}): Promise<PickedDriveFile | null> => {
  await loadPicker(ownerDocument, ownerWindow);

  const picker = (ownerWindow as any).google?.picker;
  if (!picker) {
    throw new Error("Google Picker is unavailable");
  }

  return new Promise<PickedDriveFile | null>((resolve) => {
    // "Recent": flat list of `.excalidraw` documents
    const recentView = new picker.DocsView(picker.ViewId.DOCS);
    recentView.setMimeTypes(MIME_TYPES.excalidraw);
    recentView.setLabel(t("googleDrive.openPickerRecentView"));

    // "Folders": same documents, plus folder navigation
    const foldersView = new picker.DocsView(picker.ViewId.DOCS);
    foldersView.setMimeTypes(MIME_TYPES.excalidraw);
    foldersView.setIncludeFolders(true);
    foldersView.setLabel(t("googleDrive.openPickerFoldersView"));

    const pickerBuilder = new picker.PickerBuilder()
      .setOAuthToken(accessToken)
      .setDeveloperKey(getGoogleApiKey())
      .setAppId(getGoogleAppId())
      .addView(recentView)
      .addView(foldersView)
      .setCallback((data: any) => {
        const action = data[picker.Response.ACTION];
        if (action === picker.Action.PICKED) {
          const [document] = data[picker.Response.DOCUMENTS] ?? [];
          if (document) {
            resolve({
              id: document[picker.Document.ID],
              name: document[picker.Document.NAME],
              mimeType: document[picker.Document.MIME_TYPE],
            });
            return;
          }
        }
        if (
          action === picker.Action.CANCEL ||
          action === picker.Action.PICKED
        ) {
          resolve(null);
        }
      });

    pickerBuilder.build().setVisible(true);
  });
};

/**
 * Opens the Picker in folder-selection mode and resolves the folder the user
 * chose (or `null` if they cancelled). Used to pick where a new scene is saved.
 */
export const pickDriveFolder = async ({
  ownerDocument,
  ownerWindow,
  accessToken,
}: {
  ownerDocument: Document;
  ownerWindow: Window & typeof globalThis;
  accessToken: string;
}): Promise<DriveFile | null> => {
  await loadPicker(ownerDocument, ownerWindow);

  const picker = (ownerWindow as any).google?.picker;
  if (!picker) {
    throw new Error("Google Picker is unavailable");
  }

  return new Promise<DriveFile | null>((resolve) => {
    const myDriveView = new picker.DocsView(picker.ViewId.FOLDERS);
    myDriveView.setSelectFolderEnabled(true);
    myDriveView.setOwnedByMe(true);
    myDriveView.setLabel(t("googleDrive.saveFolderPickerMyDriveView"));

    const sharedView = new picker.DocsView(picker.ViewId.FOLDERS);
    sharedView.setSelectFolderEnabled(true);
    sharedView.setOwnedByMe(false);
    sharedView.setLabel(t("googleDrive.saveFolderPickerSharedView"));

    const pickerBuilder = new picker.PickerBuilder()
      .setOAuthToken(accessToken)
      .setDeveloperKey(getGoogleApiKey())
      .setAppId(getGoogleAppId())
      .setTitle(t("googleDrive.saveFolderPickerTitle"))
      .addView(myDriveView)
      .addView(sharedView)
      .setCallback((data: any) => {
        const action = data[picker.Response.ACTION];
        if (action === picker.Action.PICKED) {
          const [folder] = data[picker.Response.DOCUMENTS] ?? [];
          if (folder) {
            resolve({
              id: folder[picker.Document.ID],
              name: folder[picker.Document.NAME],
            });
            return;
          }
        }
        if (
          action === picker.Action.CANCEL ||
          action === picker.Action.PICKED
        ) {
          resolve(null);
        }
      });

    pickerBuilder.build().setVisible(true);
  });
};

/**
 * Google Drive Storage Adapter
 * Handles saving and loading board data to/from Google Drive
 */

import { serializeAsJSON } from "@excalidraw/excalidraw/data/json";

import type { ExcalidrawElement } from "@excalidraw/element/types";
import type { AppState, BinaryFiles } from "@excalidraw/excalidraw/types";
import type { ImportedDataState } from "@excalidraw/excalidraw/data/types";

import { appJotaiStore } from "../app-jotai";
import { googleDriveAuthAtom, currentBoardIdAtom } from "../app-jotai";

import { GoogleDriveService } from "./GoogleDrive";

export class GoogleDriveStorage {
  /**
   * Save board data to Google Drive
   */
  static async save(
    elements: readonly ExcalidrawElement[],
    appState: AppState,
    files: BinaryFiles,
  ): Promise<void> {
    const auth = appJotaiStore.get(googleDriveAuthAtom);
    const currentBoardId = appJotaiStore.get(currentBoardIdAtom);

    if (!auth.isAuthenticated || !auth.accessToken || !currentBoardId) {
      throw new Error("Not authenticated or no board selected");
    }

    // Serialize the scene data
    const jsonData = serializeAsJSON(elements, appState, files, "local");

    // Save to Google Drive
    await GoogleDriveService.saveBoard(
      auth.accessToken,
      currentBoardId,
      jsonData,
    );
  }

  /**
   * Load board data from Google Drive
   */
  static async loadBoard(boardId: string): Promise<ImportedDataState> {
    const auth = appJotaiStore.get(googleDriveAuthAtom);

    if (!auth.isAuthenticated || !auth.accessToken) {
      throw new Error("Not authenticated");
    }

    // Load from Google Drive
    const jsonData = await GoogleDriveService.loadBoard(
      auth.accessToken,
      boardId,
    );

    // Parse and restore the data
    const data: ImportedDataState = JSON.parse(jsonData);
    return data;
  }

  /**
   * Check if Google Drive storage is active
   */
  static isActive(): boolean {
    const auth = appJotaiStore.get(googleDriveAuthAtom);
    const currentBoardId = appJotaiStore.get(currentBoardIdAtom);
    return auth.isAuthenticated && !!currentBoardId;
  }
}

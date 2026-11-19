import { createStore, get, set, del, entries } from "idb-keyval";

import { isInitializedImageElement } from "@excalidraw/element";
import {
  clearAppStateForLocalStorage,
  getDefaultAppState,
} from "@excalidraw/excalidraw/appState";
import { getNonDeletedElements } from "@excalidraw/element";

import type { ExcalidrawElement, FileId } from "@excalidraw/element/types";
import type { AppState } from "@excalidraw/excalidraw/types";

import { STORAGE_KEYS } from "../app_constants";

import { importFromLocalStorage } from "./localStorage";

export interface SheetMetadata {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}

export interface SheetsIndex {
  activeSheetId: string;
  sheets: SheetMetadata[];
}

export interface SheetSceneData {
  elements: readonly ExcalidrawElement[];
  appState: Partial<AppState>;
}

export const sheetsStore = createStore("excalidraw-sheets-db", "sheets-store");

export const getSheetsIndex = (): SheetsIndex | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_SHEETS_INDEX);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as SheetsIndex;
    if (
      parsed &&
      typeof parsed.activeSheetId === "string" &&
      Array.isArray(parsed.sheets) &&
      parsed.sheets.length > 0
    ) {
      return parsed;
    }
  } catch (error) {
    console.error("Error reading sheets index from localStorage", error);
  }
  return null;
};

export const saveSheetsIndex = (index: SheetsIndex): void => {
  try {
    localStorage.setItem(
      STORAGE_KEYS.LOCAL_STORAGE_SHEETS_INDEX,
      JSON.stringify(index),
    );
  } catch (error) {
    console.error("Error saving sheets index to localStorage", error);
  }
};

export const getSheetData = async (
  sheetId: string,
): Promise<SheetSceneData | null> => {
  try {
    const data = await get<SheetSceneData>(
      `${STORAGE_KEYS.IDB_SHEET_DATA_PREFIX}${sheetId}`,
      sheetsStore,
    );
    return data || null;
  } catch (error) {
    console.error(`Error loading sheet data for sheet ${sheetId}`, error);
    return null;
  }
};

export const saveSheetData = async (
  sheetId: string,
  data: SheetSceneData,
): Promise<void> => {
  try {
    await set(
      `${STORAGE_KEYS.IDB_SHEET_DATA_PREFIX}${sheetId}`,
      {
        elements: getNonDeletedElements(data.elements || []),
        appState: data.appState
          ? clearAppStateForLocalStorage(data.appState as AppState)
          : {},
      },
      sheetsStore,
    );
  } catch (error) {
    console.error(`Error saving sheet data for sheet ${sheetId}`, error);
  }
};

export const deleteSheetData = async (sheetId: string): Promise<void> => {
  try {
    await del(`${STORAGE_KEYS.IDB_SHEET_DATA_PREFIX}${sheetId}`, sheetsStore);
  } catch (error) {
    console.error(`Error deleting sheet data for sheet ${sheetId}`, error);
  }
};

export const initializeSheets = async (): Promise<SheetsIndex> => {
  const existingIndex = getSheetsIndex();
  if (existingIndex) {
    if (
      !existingIndex.sheets.some((s) => s.id === existingIndex.activeSheetId)
    ) {
      existingIndex.activeSheetId = existingIndex.sheets[0].id;
      saveSheetsIndex(existingIndex);
    }
    return existingIndex;
  }

  // Backward-Compatible Migration:
  // If legacy single-canvas data exists and sheets index does not, migrate to Sheet 1.
  const legacy = importFromLocalStorage();
  const sheet1Id = `sheet_${Date.now()}_${Math.random()
    .toString(36)
    .substring(2, 9)}`;
  const now = Date.now();
  const sheet1: SheetMetadata = {
    id: sheet1Id,
    title: "Sheet 1",
    createdAt: now,
    updatedAt: now,
  };
  const newIndex: SheetsIndex = {
    activeSheetId: sheet1Id,
    sheets: [sheet1],
  };

  if (legacy && (legacy.elements?.length || legacy.appState)) {
    await saveSheetData(sheet1Id, {
      elements: legacy.elements || [],
      appState: legacy.appState || {},
    });
  } else {
    await saveSheetData(sheet1Id, {
      elements: [],
      appState: {},
    });
  }

  saveSheetsIndex(newIndex);
  return newIndex;
};

export const loadActiveSheetScene = async (): Promise<
  ReturnType<typeof importFromLocalStorage>
> => {
  const index = await initializeSheets();
  const sheetData = await getSheetData(index.activeSheetId);
  if (sheetData) {
    return {
      elements: (sheetData.elements as ExcalidrawElement[]) || [],
      appState: sheetData.appState
        ? {
            ...getDefaultAppState(),
            ...sheetData.appState,
          }
        : null,
    };
  }

  return importFromLocalStorage();
};

export const saveActiveSheetDataToIndexedDB = async (
  elements: readonly ExcalidrawElement[],
  appState: AppState,
): Promise<void> => {
  const index = getSheetsIndex();
  if (!index || !index.activeSheetId) {
    return;
  }

  await saveSheetData(index.activeSheetId, {
    elements,
    appState,
  });

  const updatedSheets = index.sheets.map((s) =>
    s.id === index.activeSheetId ? { ...s, updatedAt: Date.now() } : s,
  );
  saveSheetsIndex({
    ...index,
    sheets: updatedSheets,
  });
};

export const getAllSheetsFileIds = async (): Promise<FileId[]> => {
  const fileIds: FileId[] = [];
  try {
    const allEntries = await entries(sheetsStore);
    for (const [, val] of allEntries) {
      const sheet = val as SheetSceneData | undefined;
      if (sheet && Array.isArray(sheet.elements)) {
        for (const el of sheet.elements) {
          if (isInitializedImageElement(el)) {
            fileIds.push(el.fileId);
          }
        }
      }
    }
  } catch (error) {
    console.error("Error reading all sheets file IDs", error);
  }
  return fileIds;
};

export const getNextSheetTitle = (sheets: SheetMetadata[]): string => {
  let maxNum = 0;
  const regex = /^Sheet\s+(\d+)$/i;
  for (const sheet of sheets) {
    const match = sheet.title.trim().match(regex);
    if (match) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    }
  }
  return `Sheet ${maxNum > 0 ? maxNum + 1 : sheets.length + 1}`;
};

export const getDuplicateSheetTitle = (
  baseTitle: string,
  sheets: SheetMetadata[],
): string => {
  const existingTitles = new Set(
    sheets.map((s) => s.title.trim().toLowerCase()),
  );
  const cleanBase = baseTitle.trim();
  const candidate = `${cleanBase} (Copy)`;
  if (!existingTitles.has(candidate.toLowerCase())) {
    return candidate;
  }
  let count = 2;
  while (existingTitles.has(`${cleanBase} (Copy ${count})`.toLowerCase())) {
    count++;
  }
  return `${cleanBase} (Copy ${count})`;
};

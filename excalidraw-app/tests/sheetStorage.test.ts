import { beforeEach, describe, expect, it } from "vitest";

import { STORAGE_KEYS } from "../app_constants";
import {
  deleteSheetData,
  getAllSheetsFileIds,
  getDuplicateSheetTitle,
  getNextSheetTitle,
  getSheetData,
  getSheetsIndex,
  initializeSheets,
  loadActiveSheetScene,
  saveActiveSheetDataToIndexedDB,
  saveSheetData,
  saveSheetsIndex,
} from "../data/sheetStorage";

describe("sheetStorage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("title generation", () => {
    it("generates next sequential sheet title", () => {
      expect(getNextSheetTitle([])).toBe("Sheet 1");

      expect(
        getNextSheetTitle([
          { id: "1", title: "Sheet 1", createdAt: 0, updatedAt: 0 },
        ]),
      ).toBe("Sheet 2");

      expect(
        getNextSheetTitle([
          { id: "1", title: "Sheet 1", createdAt: 0, updatedAt: 0 },
          { id: "2", title: "Sheet 2", createdAt: 0, updatedAt: 0 },
          { id: "3", title: "Design Architecture", createdAt: 0, updatedAt: 0 },
        ]),
      ).toBe("Sheet 3");

      expect(
        getNextSheetTitle([
          { id: "1", title: "Sheet 4", createdAt: 0, updatedAt: 0 },
        ]),
      ).toBe("Sheet 5");
    });

    it("generates duplicate titles cleanly", () => {
      const sheets = [
        { id: "1", title: "Sheet 1", createdAt: 0, updatedAt: 0 },
      ];

      expect(getDuplicateSheetTitle("Sheet 1", sheets)).toBe("Sheet 1 (Copy)");

      const sheetsWithCopy = [
        ...sheets,
        { id: "2", title: "Sheet 1 (Copy)", createdAt: 0, updatedAt: 0 },
      ];
      expect(getDuplicateSheetTitle("Sheet 1", sheetsWithCopy)).toBe(
        "Sheet 1 (Copy 2)",
      );

      const sheetsWithCopy2 = [
        ...sheetsWithCopy,
        { id: "3", title: "Sheet 1 (Copy 2)", createdAt: 0, updatedAt: 0 },
      ];
      expect(getDuplicateSheetTitle("Sheet 1", sheetsWithCopy2)).toBe(
        "Sheet 1 (Copy 3)",
      );
    });
  });

  describe("sheets index and storage", () => {
    it("returns null when index does not exist in localStorage", () => {
      expect(getSheetsIndex()).toBeNull();
    });

    it("saves and retrieves sheets index", () => {
      const index = {
        activeSheetId: "sheet-1",
        sheets: [
          { id: "sheet-1", title: "Sheet 1", createdAt: 100, updatedAt: 100 },
        ],
      };
      saveSheetsIndex(index);
      expect(getSheetsIndex()).toEqual(index);
    });

    it("initializes a fresh Sheet 1 when no index and no legacy data exists", async () => {
      const index = await initializeSheets();
      expect(index.sheets.length).toBe(1);
      expect(index.sheets[0].title).toBe("Sheet 1");
      expect(index.activeSheetId).toBe(index.sheets[0].id);

      const sheetData = await getSheetData(index.activeSheetId);
      expect(sheetData).toBeDefined();
      expect(sheetData?.elements).toEqual([]);
    });

    it("migrates legacy localStorage data to Sheet 1", async () => {
      const mockElement = {
        id: "el-1",
        type: "rectangle",
        x: 10,
        y: 20,
        width: 100,
        height: 50,
        isDeleted: false,
      };
      localStorage.setItem(
        STORAGE_KEYS.LOCAL_STORAGE_ELEMENTS,
        JSON.stringify([mockElement]),
      );
      localStorage.setItem(
        STORAGE_KEYS.LOCAL_STORAGE_APP_STATE,
        JSON.stringify({ viewBackgroundColor: "#ff0000" }),
      );

      const index = await initializeSheets();
      expect(index.sheets.length).toBe(1);
      expect(index.sheets[0].title).toBe("Sheet 1");

      const sheetData = await getSheetData(index.activeSheetId);
      expect(sheetData).toBeDefined();
      expect(sheetData?.elements.length).toBe(1);
      expect(sheetData?.elements[0].id).toBe("el-1");
      expect(sheetData?.appState.viewBackgroundColor).toBe("#ff0000");
    });

    it("loads active sheet scene properly", async () => {
      const scene = await loadActiveSheetScene();
      expect(scene).toBeDefined();
      expect(Array.isArray(scene.elements)).toBe(true);
    });

    it("saves, retrieves, and deletes sheet data in IndexedDB", async () => {
      const sheetId = "test-sheet-crud";
      await saveSheetData(sheetId, {
        elements: [
          {
            id: "rect-1",
            type: "rectangle",
            x: 0,
            y: 0,
            width: 50,
            height: 50,
            isDeleted: false,
          } as any,
        ],
        appState: { viewBackgroundColor: "#ffffff" } as any,
      });

      const loaded = await getSheetData(sheetId);
      expect(loaded).toBeDefined();
      expect(loaded?.elements.length).toBe(1);
      expect(loaded?.elements[0].id).toBe("rect-1");

      await deleteSheetData(sheetId);
      const afterDelete = await getSheetData(sheetId);
      expect(afterDelete).toBeNull();
    });

    it("saves active sheet data and updates timestamp", async () => {
      const index = await initializeSheets();
      const initialTimestamp = index.sheets[0].updatedAt;

      await new Promise((resolve) => setTimeout(resolve, 5));

      await saveActiveSheetDataToIndexedDB(
        [
          {
            id: "line-1",
            type: "line",
            x: 5,
            y: 5,
            isDeleted: false,
          } as any,
        ],
        { viewBackgroundColor: "#00ff00" } as any,
      );

      const updatedIndex = getSheetsIndex();
      expect(updatedIndex).toBeDefined();
      expect(updatedIndex?.sheets[0].updatedAt).toBeGreaterThan(
        initialTimestamp,
      );

      const savedData = await getSheetData(index.activeSheetId);
      expect(savedData?.elements.length).toBe(1);
      expect(savedData?.elements[0].id).toBe("line-1");
    });

    it("collects all image file IDs across sheets", async () => {
      const sheet1Id = "sheet-img-1";
      const sheet2Id = "sheet-img-2";

      await saveSheetData(sheet1Id, {
        elements: [
          {
            id: "img-el-1",
            type: "image",
            fileId: "file-abc",
            status: "saved",
            isDeleted: false,
          } as any,
        ],
        appState: {},
      });

      await saveSheetData(sheet2Id, {
        elements: [
          {
            id: "img-el-2",
            type: "image",
            fileId: "file-xyz",
            status: "saved",
            isDeleted: false,
          } as any,
        ],
        appState: {},
      });

      const fileIds = await getAllSheetsFileIds();
      expect(fileIds).toContain("file-abc");
      expect(fileIds).toContain("file-xyz");
    });
  });
});

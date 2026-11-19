import React, { useCallback, useEffect, useRef, useState } from "react";
import { CaptureUpdateAction } from "@excalidraw/excalidraw";
import {
  restoreAppState,
  restoreElements,
} from "@excalidraw/excalidraw/data/restore";
import { clearAppStateForLocalStorage } from "@excalidraw/excalidraw/appState";
import { isInitializedImageElement } from "@excalidraw/element";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type { FileId } from "@excalidraw/element/types";

import {
  deleteSheetData,
  getDuplicateSheetTitle,
  getNextSheetTitle,
  getSheetData,
  getSheetsIndex,
  initializeSheets,
  saveSheetData,
  saveSheetsIndex,
  type SheetMetadata,
} from "../../data/sheetStorage";
import { LocalData } from "../../data/LocalData";
import { updateStaleImageStatuses } from "../../data/FileManager";

import { PlusIcon } from "./icons";
import { SheetTab } from "./SheetTab";
import { SheetMenu } from "./SheetMenu";
import { DeleteConfirmDialog } from "./DeleteConfirmDialog";

import "./SheetManager.scss";

interface SheetManagerProps {
  excalidrawAPI: ExcalidrawImperativeAPI;
}

export const SheetManager: React.FC<SheetManagerProps> = ({
  excalidrawAPI,
}) => {
  const [sheets, setSheets] = useState<SheetMetadata[]>([]);
  const [activeSheetId, setActiveSheetId] = useState<string>("");
  const [editingSheetId, setEditingSheetId] = useState<string | null>(null);

  const [menuState, setMenuState] = useState<{
    sheetId: string;
    anchorRect: DOMRect | null;
    coords?: { x: number; y: number } | null;
  } | null>(null);

  const [deleteDialogSheet, setDeleteDialogSheet] =
    useState<SheetMetadata | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  const tabsWrapperRef = useRef<HTMLDivElement>(null);

  const appState = excalidrawAPI?.getAppState();
  const isDark =
    appState?.theme === "dark" ||
    document.querySelector(".excalidraw")?.classList.contains("theme--dark");
  const isZenMode = !!appState?.zenModeEnabled;

  // Initialize sheets on mount
  useEffect(() => {
    let isMounted = true;
    initializeSheets().then((index) => {
      if (isMounted) {
        setSheets(index.sheets);
        setActiveSheetId(index.activeSheetId);
      }
    });

    const doc = rootRef.current?.ownerDocument || document;
    const win = doc.defaultView || window;

    // Listen for storage changes across tabs
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "excalidraw-sheets-index" && e.newValue) {
        try {
          const updated = JSON.parse(e.newValue);
          if (updated && Array.isArray(updated.sheets)) {
            setSheets(updated.sheets);
            if (updated.activeSheetId) {
              setActiveSheetId(updated.activeSheetId);
            }
          }
        } catch (err) {
          console.error(err);
        }
      }
    };

    win.addEventListener("storage", handleStorageChange);
    return () => {
      isMounted = false;
      win.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  // Save current active sheet helper
  const flushAndSaveCurrentSheet = useCallback(async () => {
    if (!activeSheetId || !excalidrawAPI) {
      return;
    }
    LocalData.flushSave();
    const currentElements = excalidrawAPI.getSceneElements();
    const currentAppState = excalidrawAPI.getAppState();
    await saveSheetData(activeSheetId, {
      elements: currentElements,
      appState: clearAppStateForLocalStorage(currentAppState),
    });
  }, [activeSheetId, excalidrawAPI]);

  // Load image files for a sheet
  const loadImagesForSheet = useCallback(
    (elements: readonly any[]) => {
      if (!excalidrawAPI) {
        return;
      }
      const fileIds = elements.reduce((acc, el) => {
        if (isInitializedImageElement(el)) {
          return acc.concat(el.fileId);
        }
        return acc;
      }, [] as FileId[]);

      if (fileIds.length) {
        LocalData.fileStorage
          .getFiles(fileIds)
          .then(({ loadedFiles, erroredFiles }) => {
            if (loadedFiles.length) {
              excalidrawAPI.addFiles(loadedFiles);
            }
            updateStaleImageStatuses({
              excalidrawAPI,
              erroredFiles,
              elements: excalidrawAPI.getSceneElementsIncludingDeleted(),
            });
          });
      }
    },
    [excalidrawAPI],
  );

  // Switch sheet
  const handleSwitchSheet = useCallback(
    async (targetSheetId: string) => {
      if (targetSheetId === activeSheetId || !excalidrawAPI) {
        return;
      }

      await flushAndSaveCurrentSheet();

      setActiveSheetId(targetSheetId);
      const currentIndex = getSheetsIndex();
      if (currentIndex) {
        saveSheetsIndex({
          ...currentIndex,
          activeSheetId: targetSheetId,
        });
      }

      const targetData = await getSheetData(targetSheetId);
      if (targetData && targetData.elements) {
        const elements = restoreElements(targetData.elements, null, {
          repairBindings: true,
        });
        const targetAppState = restoreAppState(targetData.appState || {}, null);

        excalidrawAPI.updateScene({
          elements,
          appState: {
            ...targetAppState,
            theme: excalidrawAPI.getAppState().theme,
          },
          captureUpdate: CaptureUpdateAction.IMMEDIATELY,
        });

        loadImagesForSheet(elements);
        excalidrawAPI.history.clear();
      } else {
        excalidrawAPI.resetScene();
      }

      LocalData.flushSave();
    },
    [
      activeSheetId,
      excalidrawAPI,
      flushAndSaveCurrentSheet,
      loadImagesForSheet,
    ],
  );

  // Create sheet
  const handleCreateSheet = useCallback(async () => {
    if (!excalidrawAPI) {
      return;
    }

    await flushAndSaveCurrentSheet();

    const newTitle = getNextSheetTitle(sheets);
    const newSheetId = `sheet_${Date.now()}_${Math.random()
      .toString(36)
      .substring(2, 9)}`;
    const now = Date.now();
    const newSheet: SheetMetadata = {
      id: newSheetId,
      title: newTitle,
      createdAt: now,
      updatedAt: now,
    };

    await saveSheetData(newSheetId, {
      elements: [],
      appState: {},
    });

    const updatedSheets = [...sheets, newSheet];
    setSheets(updatedSheets);
    setActiveSheetId(newSheetId);
    saveSheetsIndex({
      activeSheetId: newSheetId,
      sheets: updatedSheets,
    });

    excalidrawAPI.resetScene();

    // Scroll to end where new tab is
    setTimeout(() => {
      if (tabsWrapperRef.current) {
        tabsWrapperRef.current.scrollTo({
          left: tabsWrapperRef.current.scrollWidth,
          behavior: "smooth",
        });
      }
    }, 50);
  }, [excalidrawAPI, flushAndSaveCurrentSheet, sheets]);

  // Rename sheet
  const handleCommitRename = useCallback(
    (sheetId: string, newTitle: string) => {
      const trimmed = newTitle.trim();
      setEditingSheetId(null);
      if (!trimmed) {
        return;
      }

      const updatedSheets = sheets.map((s) =>
        s.id === sheetId ? { ...s, title: trimmed, updatedAt: Date.now() } : s,
      );
      setSheets(updatedSheets);
      saveSheetsIndex({
        activeSheetId,
        sheets: updatedSheets,
      });
    },
    [activeSheetId, sheets],
  );

  // Duplicate sheet
  const handleDuplicateSheet = useCallback(
    async (sourceSheetId: string) => {
      if (!excalidrawAPI) {
        return;
      }

      if (sourceSheetId === activeSheetId) {
        await flushAndSaveCurrentSheet();
      }

      const sourceData = await getSheetData(sourceSheetId);
      const sourceMeta = sheets.find((s) => s.id === sourceSheetId);
      const baseTitle = sourceMeta ? sourceMeta.title : "Sheet";
      const newTitle = getDuplicateSheetTitle(baseTitle, sheets);

      const newSheetId = `sheet_${Date.now()}_${Math.random()
        .toString(36)
        .substring(2, 9)}`;
      const now = Date.now();
      const newSheet: SheetMetadata = {
        id: newSheetId,
        title: newTitle,
        createdAt: now,
        updatedAt: now,
      };

      const clonedElements = sourceData?.elements
        ? JSON.parse(JSON.stringify(sourceData.elements))
        : [];
      const clonedAppState = sourceData?.appState
        ? JSON.parse(JSON.stringify(sourceData.appState))
        : {};

      await saveSheetData(newSheetId, {
        elements: clonedElements,
        appState: clonedAppState,
      });

      const sourceIndex = sheets.findIndex((s) => s.id === sourceSheetId);
      const updatedSheets = [...sheets];
      updatedSheets.splice(
        sourceIndex >= 0 ? sourceIndex + 1 : updatedSheets.length,
        0,
        newSheet,
      );

      setSheets(updatedSheets);
      setActiveSheetId(newSheetId);
      saveSheetsIndex({
        activeSheetId: newSheetId,
        sheets: updatedSheets,
      });

      const restoredElements = restoreElements(clonedElements, null, {
        repairBindings: true,
      });
      const restoredAppState = restoreAppState(clonedAppState, null);

      excalidrawAPI.updateScene({
        elements: restoredElements,
        appState: {
          ...restoredAppState,
          theme: excalidrawAPI.getAppState().theme,
        },
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });

      loadImagesForSheet(restoredElements);
      excalidrawAPI.history.clear();
      LocalData.flushSave();
    },
    [
      activeSheetId,
      excalidrawAPI,
      flushAndSaveCurrentSheet,
      loadImagesForSheet,
      sheets,
    ],
  );

  // Delete sheet
  const handleConfirmDelete = useCallback(async () => {
    if (!deleteDialogSheet || !excalidrawAPI) {
      return;
    }

    const sheetIdToDelete = deleteDialogSheet.id;
    setDeleteDialogSheet(null);

    await deleteSheetData(sheetIdToDelete);

    const remainingSheets = sheets.filter((s) => s.id !== sheetIdToDelete);

    if (remainingSheets.length === 0) {
      const freshSheetId = `sheet_${Date.now()}_${Math.random()
        .toString(36)
        .substring(2, 9)}`;
      const now = Date.now();
      const freshSheet: SheetMetadata = {
        id: freshSheetId,
        title: "Sheet 1",
        createdAt: now,
        updatedAt: now,
      };
      await saveSheetData(freshSheetId, { elements: [], appState: {} });
      setSheets([freshSheet]);
      setActiveSheetId(freshSheetId);
      saveSheetsIndex({
        activeSheetId: freshSheetId,
        sheets: [freshSheet],
      });
      excalidrawAPI.resetScene();
      LocalData.flushSave();
      return;
    }

    if (sheetIdToDelete === activeSheetId) {
      const deletedIndex = sheets.findIndex((s) => s.id === sheetIdToDelete);
      const nextIndex = Math.min(deletedIndex, remainingSheets.length - 1);
      const nextActiveSheet = remainingSheets[nextIndex];

      setSheets(remainingSheets);
      setActiveSheetId(nextActiveSheet.id);
      saveSheetsIndex({
        activeSheetId: nextActiveSheet.id,
        sheets: remainingSheets,
      });

      const nextData = await getSheetData(nextActiveSheet.id);
      if (nextData && nextData.elements) {
        const elements = restoreElements(nextData.elements, null, {
          repairBindings: true,
        });
        const targetAppState = restoreAppState(nextData.appState || {}, null);

        excalidrawAPI.updateScene({
          elements,
          appState: {
            ...targetAppState,
            theme: excalidrawAPI.getAppState().theme,
          },
          captureUpdate: CaptureUpdateAction.IMMEDIATELY,
        });
        loadImagesForSheet(elements);
        excalidrawAPI.history.clear();
      } else {
        excalidrawAPI.resetScene();
      }
      LocalData.flushSave();
    } else {
      setSheets(remainingSheets);
      saveSheetsIndex({
        activeSheetId,
        sheets: remainingSheets,
      });
    }
  }, [
    activeSheetId,
    deleteDialogSheet,
    excalidrawAPI,
    loadImagesForSheet,
    sheets,
  ]);

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.deltaY !== 0 && e.deltaX === 0 && tabsWrapperRef.current) {
      tabsWrapperRef.current.scrollBy({ left: e.deltaY, behavior: "auto" });
    }
  };

  return (
    <div
      className={`sheet-manager ${isZenMode ? "sheet-manager--zen-mode" : ""}`}
      ref={rootRef}
    >
      <div className="sheet-manager__island Island">
        <div
          className="sheet-manager__tabs-wrapper"
          ref={tabsWrapperRef}
          onWheel={handleWheel}
        >
          <div className="sheet-manager__tabs">
            {sheets.map((sheet) => (
              <SheetTab
                key={sheet.id}
                sheet={sheet}
                isActive={sheet.id === activeSheetId}
                isEditing={editingSheetId === sheet.id}
                onSelect={() => handleSwitchSheet(sheet.id)}
                onStartRename={() => setEditingSheetId(sheet.id)}
                onCommitRename={(newTitle) =>
                  handleCommitRename(sheet.id, newTitle)
                }
                onCancelRename={() => setEditingSheetId(null)}
                onOpenMenu={(anchorRect, coords) =>
                  setMenuState({ sheetId: sheet.id, anchorRect, coords })
                }
              />
            ))}
          </div>
        </div>

        <div className="sheet-manager__divider" />

        <button
          type="button"
          className="sheet-manager__add-btn"
          title="New sheet"
          aria-label="New sheet"
          onClick={handleCreateSheet}
        >
          <PlusIcon />
        </button>
      </div>

      <SheetMenu
        isOpen={!!menuState}
        onClose={() => setMenuState(null)}
        anchorRect={menuState?.anchorRect || null}
        coords={menuState?.coords || null}
        isDark={isDark}
        onRename={() => {
          if (menuState) {
            setEditingSheetId(menuState.sheetId);
          }
        }}
        onDuplicate={() => {
          if (menuState) {
            handleDuplicateSheet(menuState.sheetId);
          }
        }}
        onDelete={() => {
          if (menuState) {
            const sheetToDelete = sheets.find(
              (s) => s.id === menuState.sheetId,
            );
            if (sheetToDelete) {
              setDeleteDialogSheet(sheetToDelete);
            }
          }
        }}
      />

      <DeleteConfirmDialog
        isOpen={!!deleteDialogSheet}
        sheetTitle={deleteDialogSheet?.title || ""}
        isOnlySheet={sheets.length <= 1}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteDialogSheet(null)}
        isDark={isDark}
      />
    </div>
  );
};

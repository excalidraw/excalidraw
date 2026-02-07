import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { MIME_TYPES, arrayToMap, nextAnimationFrame } from "@excalidraw/common";

import { duplicateElements } from "@excalidraw/element";

import clsx from "clsx";

import { deburr } from "../deburr";

import { useLibraryCache } from "../hooks/useLibraryItemSvg";
import { useScrollPosition } from "../hooks/useScrollPosition";
import { t } from "../i18n";
import { libraryCollectionsAtom } from "../data/library";
import { useAtom } from "../editor-jotai";

import { LibraryMenuControlButtons } from "./LibraryMenuControlButtons";
import {
  CollectionHeaderDropdown,
  LibraryDropdownMenu,
} from "./LibraryMenuHeaderContent";
import {
  LibraryMenuSection,
  LibraryMenuSectionGrid,
} from "./LibraryMenuSection";

import Spinner from "./Spinner";
import Stack from "./Stack";

import "./LibraryMenuItems.scss";

import { TextField } from "./TextField";

import { useApp, useEditorInterface, useExcalidrawSetAppState } from "./App";

import { Button } from "./Button";
import { collapseDownIcon, collapseUpIcon } from "./icons";

import type { ExcalidrawLibraryIds } from "../data/types";

import type {
  ExcalidrawProps,
  LibraryItem,
  LibraryItems,
  UIAppState,
} from "../types";

// using an odd number of items per batch so the rendering creates an irregular
// pattern which looks more organic
const ITEMS_RENDERED_PER_BATCH = 17;
// when render outputs cached we can render many more items per batch to
// speed it up
const CACHED_ITEMS_RENDERED_PER_BATCH = 64;

const COLLECTION_COLLAPSE_STATE_KEY =
  "excalidraw-library-collection-collapse-state";
const PERSONAL_LIBRARY_COLLAPSE_KEY = "excalidraw-library-personal-collapsed";
const EXCALIDRAW_LIBRARY_COLLAPSE_KEY =
  "excalidraw-library-excalidraw-collapsed";

export default function LibraryMenuItems({
  isLoading,
  libraryItems,
  onAddToLibrary,
  onInsertLibraryItems,
  pendingElements,
  theme,
  id,
  libraryReturnUrl,
  onSelectItems,
  selectedItems,
}: {
  isLoading: boolean;
  libraryItems: LibraryItems;
  pendingElements: LibraryItem["elements"];
  onInsertLibraryItems: (libraryItems: LibraryItems) => void;
  onAddToLibrary: (
    elements: LibraryItem["elements"],
    collectionId?: string,
  ) => void;
  libraryReturnUrl: ExcalidrawProps["libraryReturnUrl"];
  theme: UIAppState["theme"];
  id: string;
  selectedItems: LibraryItem["id"][];
  onSelectItems: (id: LibraryItem["id"][]) => void;
}) {
  const app = useApp();
  const setAppState = useExcalidrawSetAppState();
  const editorInterface = useEditorInterface();
  const libraryContainerRef = useRef<HTMLDivElement>(null);
  const scrollPosition = useScrollPosition<HTMLDivElement>(libraryContainerRef);

  // This effect has to be called only on first render, therefore  `scrollPosition` isn't in the dependency array
  useEffect(() => {
    if (scrollPosition > 0) {
      libraryContainerRef.current?.scrollTo(0, scrollPosition);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const { svgCache } = useLibraryCache();
  const [lastSelectedItem, setLastSelectedItem] = useState<
    LibraryItem["id"] | null
  >(null);

  const [searchInputValue, setSearchInputValue] = useState("");

  // Load Personal Library collapse state
  const [isPersonalLibraryCollapsed, setIsPersonalLibraryCollapsed] = useState(
    () => {
      try {
        const saved = localStorage.getItem(PERSONAL_LIBRARY_COLLAPSE_KEY);
        return saved === "true";
      } catch (error) {
        console.warn("Failed to load personal library collapse state:", error);
        return false;
      }
    },
  );

  // Load Excalidraw Library collapse state
  const [isExcalidrawLibraryCollapsed, setIsExcalidrawLibraryCollapsed] =
    useState(() => {
      try {
        const saved = localStorage.getItem(EXCALIDRAW_LIBRARY_COLLAPSE_KEY);
        return saved === "true";
      } catch (error) {
        console.warn(
          "Failed to load excalidraw library collapse state:",
          error,
        );
        return false;
      }
    });

  const [libraryCollections] = useAtom(libraryCollectionsAtom);

  // Load library collections collapse state
  const [customCollectionCollapsed, setCustomCollectionCollapsed] = useState<
    Record<string, boolean>
  >(() => {
    try {
      const saved = localStorage.getItem(COLLECTION_COLLAPSE_STATE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (error) {
      console.warn("Failed to load collection collapse state:", error);
    }
    return {};
  });

  // Save Personal Library collapse state to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(
        PERSONAL_LIBRARY_COLLAPSE_KEY,
        String(isPersonalLibraryCollapsed),
      );
    } catch (error) {
      console.warn("Failed to save personal library collapse state:", error);
    }
  }, [isPersonalLibraryCollapsed]);

  // Save Excalidraw Library collapse state to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(
        EXCALIDRAW_LIBRARY_COLLAPSE_KEY,
        String(isExcalidrawLibraryCollapsed),
      );
    } catch (error) {
      console.warn("Failed to save excalidraw library collapse state:", error);
    }
  }, [isExcalidrawLibraryCollapsed]);

  // Save library collections collapse state to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(
        COLLECTION_COLLAPSE_STATE_KEY,
        JSON.stringify(customCollectionCollapsed),
      );
    } catch (error) {
      console.warn("Failed to save collection collapse state:", error);
    }
  }, [customCollectionCollapsed]);

  // Clean up stale library collections IDs from localStorage
  useEffect(() => {
    const collectionIds = new Set(libraryCollections.map((c) => c.id));
    const hasStaleKeys = Object.keys(customCollectionCollapsed).some(
      (id) => !collectionIds.has(id),
    );

    if (hasStaleKeys) {
      setCustomCollectionCollapsed((prev) => {
        const cleaned: Record<string, boolean> = {};
        for (const id of collectionIds) {
          if (prev[id] !== undefined) {
            cleaned[id] = prev[id];
          }
        }
        return cleaned;
      });
    }
  }, [libraryCollections, customCollectionCollapsed]);

  const IS_LIBRARY_EMPTY = !libraryItems.length && !pendingElements.length;

  const IS_SEARCHING = !IS_LIBRARY_EMPTY && !!searchInputValue.trim();

  const filteredItems = useMemo(() => {
    const searchQuery = deburr(searchInputValue.trim().toLowerCase());
    if (!searchQuery) {
      return [];
    }

    return libraryItems.filter((item) => {
      const itemName = item.name || "";
      return (
        itemName.trim() && deburr(itemName.toLowerCase()).includes(searchQuery)
      );
    });
  }, [libraryItems, searchInputValue]);

  // Get items for each collection
  const collectionItems = useMemo(() => {
    const itemsMap: Record<string, LibraryItems> = {};
    libraryCollections.forEach((collection) => {
      itemsMap[collection.id] = libraryItems.filter(
        (item) => item.collectionId === collection.id,
      );
    });
    return itemsMap;
  }, [libraryCollections, libraryItems]);

  // Unpublished items that don't belong to any collection
  const unpublishedItems = useMemo(
    () =>
      libraryItems.filter(
        (item) =>
          item.status !== "published" &&
          (!item.collectionId ||
            !libraryCollections.some((c) => c.id === item.collectionId)),
      ),
    [libraryItems, libraryCollections],
  );

  const publishedItems = useMemo(
    () => libraryItems.filter((item) => item.status === "published"),
    [libraryItems],
  );

  const onItemSelectToggle = useCallback(
    (id: LibraryItem["id"], event: React.MouseEvent) => {
      const shouldSelect = !selectedItems.includes(id);
      // Build ordered items list: unpublished, then collections, then published
      const collectionItemsList = libraryCollections.flatMap(
        (collection) => collectionItems[collection.id] || [],
      );
      const orderedItems = [
        ...unpublishedItems,
        ...collectionItemsList,
        ...publishedItems,
      ];
      if (shouldSelect) {
        if (event.shiftKey && lastSelectedItem) {
          const rangeStart = orderedItems.findIndex(
            (item) => item.id === lastSelectedItem,
          );
          const rangeEnd = orderedItems.findIndex((item) => item.id === id);

          if (rangeStart === -1 || rangeEnd === -1) {
            onSelectItems([...selectedItems, id]);
            return;
          }

          const selectedItemsMap = arrayToMap(selectedItems);
          // Support both top-down and bottom-up selection by using min/max
          const minRange = Math.min(rangeStart, rangeEnd);
          const maxRange = Math.max(rangeStart, rangeEnd);
          const nextSelectedIds = orderedItems.reduce(
            (acc: LibraryItem["id"][], item, idx) => {
              if (
                (idx >= minRange && idx <= maxRange) ||
                selectedItemsMap.has(item.id)
              ) {
                acc.push(item.id);
              }
              return acc;
            },
            [],
          );
          onSelectItems(nextSelectedIds);
        } else {
          onSelectItems([...selectedItems, id]);
        }
        setLastSelectedItem(id);
      } else {
        setLastSelectedItem(null);
        onSelectItems(selectedItems.filter((_id) => _id !== id));
      }
    },
    [
      lastSelectedItem,
      onSelectItems,
      publishedItems,
      selectedItems,
      unpublishedItems,
      libraryCollections,
      collectionItems,
    ],
  );

  useEffect(() => {
    // if selection is removed (e.g. via esc), reset last selected item
    // so that subsequent shift+clicks don't select a large range
    if (!selectedItems.length) {
      setLastSelectedItem(null);
    }
  }, [selectedItems]);

  const getInsertedElements = useCallback(
    (id: string) => {
      let targetElements;
      if (selectedItems.includes(id)) {
        targetElements = libraryItems.filter((item) =>
          selectedItems.includes(item.id),
        );
      } else {
        targetElements = libraryItems.filter((item) => item.id === id);
      }
      return targetElements.map((item) => {
        return {
          ...item,
          // duplicate each library item before inserting on canvas to confine
          // ids and bindings to each library item. See #6465
          elements: duplicateElements({
            type: "everything",
            elements: item.elements,
            randomizeSeed: true,
          }).duplicatedElements,
        };
      });
    },
    [libraryItems, selectedItems],
  );

  const onItemDrag = useCallback(
    (id: LibraryItem["id"], event: React.DragEvent) => {
      // we want to serialize just the ids so the operation is fast and there's
      // no race condition if people drop the library items on canvas too fast
      const data: ExcalidrawLibraryIds = {
        itemIds: selectedItems.includes(id) ? selectedItems : [id],
      };
      event.dataTransfer.setData(
        MIME_TYPES.excalidrawlibIds,
        JSON.stringify(data),
      );
    },
    [selectedItems],
  );

  const isItemSelected = useCallback(
    (id: LibraryItem["id"] | null) => {
      if (!id) {
        return false;
      }
      return selectedItems.includes(id);
    },
    [selectedItems],
  );

  const onAddToLibraryClick = useCallback(
    (collectionId?: string) => {
      onAddToLibrary(pendingElements, collectionId);
    },
    [pendingElements, onAddToLibrary],
  );

  const onItemClick = useCallback(
    (id: LibraryItem["id"] | null) => {
      if (id) {
        onInsertLibraryItems(getInsertedElements(id));
      }
    },
    [getInsertedElements, onInsertLibraryItems],
  );

  const itemsRenderedPerBatch =
    svgCache.size >=
    (filteredItems.length ? filteredItems : libraryItems).length
      ? CACHED_ITEMS_RENDERED_PER_BATCH
      : ITEMS_RENDERED_PER_BATCH;

  const searchInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    // focus could be stolen by tab trigger button
    nextAnimationFrame(() => {
      searchInputRef.current?.focus();
    });
  }, []);

  const JSX_whenNotSearching = !IS_SEARCHING && (
    <>
      {!IS_LIBRARY_EMPTY && (
        <div className="library-menu-items-container__header">
          <span
            onClick={() =>
              setIsPersonalLibraryCollapsed(!isPersonalLibraryCollapsed)
            }
            style={{
              display: "flex",
              alignItems: "center",
              flex: 1,
              cursor: "pointer",
            }}
          >
            <span>{t("labels.personalLib")}</span>
            <span className="library-menu-items-container__header__arrow">
              {isPersonalLibraryCollapsed ? collapseDownIcon : collapseUpIcon}
            </span>
          </span>
        </div>
      )}
      {!isPersonalLibraryCollapsed &&
        (!pendingElements.length && !unpublishedItems.length ? (
          <div className="library-menu-items__no-items">
            {!publishedItems.length && (
              <div className="library-menu-items__no-items__label">
                {t("library.noItems")}
              </div>
            )}
            <div className="library-menu-items__no-items__hint">
              {publishedItems.length > 0
                ? t("library.hint_emptyPrivateLibrary")
                : t("library.hint_emptyLibrary")}
            </div>
          </div>
        ) : (
          <LibraryMenuSectionGrid>
            {pendingElements.length > 0 && (
              <LibraryMenuSection
                itemsRenderedPerBatch={itemsRenderedPerBatch}
                items={[{ id: null, elements: pendingElements }]}
                onItemSelectToggle={onItemSelectToggle}
                onItemDrag={onItemDrag}
                onClick={() => onAddToLibraryClick(undefined)}
                isItemSelected={isItemSelected}
                svgCache={svgCache}
              />
            )}
            <LibraryMenuSection
              itemsRenderedPerBatch={itemsRenderedPerBatch}
              items={unpublishedItems}
              onItemSelectToggle={onItemSelectToggle}
              onItemDrag={onItemDrag}
              onClick={onItemClick}
              isItemSelected={isItemSelected}
              svgCache={svgCache}
            />
          </LibraryMenuSectionGrid>
        ))}

      {/* Custom Collections */}
      {libraryCollections.map((collection, index) => {
        const items = collectionItems[collection.id] || [];
        const isCollapsed = customCollectionCollapsed[collection.id] ?? false;

        return (
          <React.Fragment key={collection.id}>
            <div
              className="library-menu-items-container__header"
              style={{ marginTop: "0.75rem" }}
            >
              <span
                onClick={() =>
                  setCustomCollectionCollapsed((prev) => ({
                    ...prev,
                    [collection.id]: !isCollapsed,
                  }))
                }
                style={{
                  display: "flex",
                  alignItems: "center",
                  flex: 1,
                  cursor: "pointer",
                }}
              >
                <span>{collection.name}</span>
                <span className="library-menu-items-container__header__arrow">
                  {isCollapsed ? collapseDownIcon : collapseUpIcon}
                </span>
              </span>
              <CollectionHeaderDropdown
                collectionName={collection.name}
                onRename={async () => {
                  const newName = window.prompt(
                    "Rename collection",
                    collection.name,
                  );
                  if (
                    newName &&
                    newName.trim() &&
                    newName !== collection.name
                  ) {
                    try {
                      await app.library.renameLibraryCollection(
                        collection.id,
                        newName.trim(),
                      );
                    } catch (error: any) {
                      setAppState({
                        errorMessage: error?.message || String(error),
                      });
                    }
                  }
                }}
                onDelete={async () => {
                  if (
                    window.confirm(`Delete "${collection.name}" collection?`)
                  ) {
                    try {
                      await app.library.deleteLibraryCollection(collection.id);
                    } catch (error: any) {
                      setAppState({
                        errorMessage: error?.message || String(error),
                      });
                    }
                  }
                }}
                onMoveUp={async () => {
                  try {
                    await app.library.moveUpCollection(collection.id);
                  } catch (error: any) {
                    setAppState({
                      errorMessage: error?.message || String(error),
                    });
                  }
                }}
                onMoveDown={async () => {
                  try {
                    await app.library.moveDownCollection(collection.id);
                  } catch (error: any) {
                    setAppState({
                      errorMessage: error?.message || String(error),
                    });
                  }
                }}
                canMoveUp={index > 0}
                canMoveDown={index < libraryCollections.length - 1}
              />
            </div>
            {!isCollapsed &&
              (items.length === 0 && !pendingElements.length ? (
                <div className="library-menu-items__no-items">
                  <div className="library-menu-items__no-items__hint">
                    {t("library.hint_emptyLibrary")}
                  </div>
                </div>
              ) : (
                <LibraryMenuSectionGrid>
                  {pendingElements.length > 0 && (
                    <LibraryMenuSection
                      itemsRenderedPerBatch={itemsRenderedPerBatch}
                      items={[{ id: null, elements: pendingElements }]}
                      onItemSelectToggle={onItemSelectToggle}
                      onItemDrag={onItemDrag}
                      onClick={() => onAddToLibraryClick(collection.id)}
                      isItemSelected={isItemSelected}
                      svgCache={svgCache}
                    />
                  )}
                  {items.length > 0 && (
                    <LibraryMenuSection
                      itemsRenderedPerBatch={itemsRenderedPerBatch}
                      items={items}
                      onItemSelectToggle={onItemSelectToggle}
                      onItemDrag={onItemDrag}
                      onClick={onItemClick}
                      isItemSelected={isItemSelected}
                      svgCache={svgCache}
                    />
                  )}
                </LibraryMenuSectionGrid>
              ))}
          </React.Fragment>
        );
      })}

      {publishedItems.length > 0 && (
        <div
          className="library-menu-items-container__header"
          style={{ marginTop: "0.75rem" }}
        >
          <span
            onClick={() =>
              setIsExcalidrawLibraryCollapsed(!isExcalidrawLibraryCollapsed)
            }
            style={{
              display: "flex",
              alignItems: "center",
              flex: 1,
              cursor: "pointer",
            }}
          >
            <span>{t("labels.excalidrawLib")}</span>
            <span className="library-menu-items-container__header__arrow">
              {isExcalidrawLibraryCollapsed ? collapseDownIcon : collapseUpIcon}
            </span>
          </span>
        </div>
      )}
      {publishedItems.length > 0 && !isExcalidrawLibraryCollapsed && (
        <LibraryMenuSectionGrid>
          <LibraryMenuSection
            itemsRenderedPerBatch={itemsRenderedPerBatch}
            items={publishedItems}
            onItemSelectToggle={onItemSelectToggle}
            onItemDrag={onItemDrag}
            onClick={onItemClick}
            isItemSelected={isItemSelected}
            svgCache={svgCache}
          />
        </LibraryMenuSectionGrid>
      )}
    </>
  );

  const JSX_whenSearching = IS_SEARCHING && (
    <>
      <div className="library-menu-items-container__header">
        {t("library.search.heading")}
        {!isLoading && (
          <div
            className="library-menu-items-container__header__hint"
            style={{ cursor: "pointer" }}
            onPointerDown={(e) => e.preventDefault()}
            onClick={(event) => {
              setSearchInputValue("");
            }}
          >
            <kbd>esc</kbd> to clear
          </div>
        )}
      </div>
      {filteredItems.length > 0 ? (
        <LibraryMenuSectionGrid>
          <LibraryMenuSection
            itemsRenderedPerBatch={itemsRenderedPerBatch}
            items={filteredItems}
            onItemSelectToggle={onItemSelectToggle}
            onItemDrag={onItemDrag}
            onClick={onItemClick}
            isItemSelected={isItemSelected}
            svgCache={svgCache}
          />
        </LibraryMenuSectionGrid>
      ) : (
        <div className="library-menu-items__no-items">
          <div className="library-menu-items__no-items__hint">
            {t("library.search.noResults")}
          </div>
          <Button
            onPointerDown={(e) => e.preventDefault()}
            onSelect={() => {
              setSearchInputValue("");
            }}
            style={{ width: "auto", marginTop: "1rem" }}
          >
            {t("library.search.clearSearch")}
          </Button>
        </div>
      )}
    </>
  );

  return (
    <div
      className="library-menu-items-container"
      style={
        pendingElements.length ||
        unpublishedItems.length ||
        publishedItems.length
          ? { justifyContent: "flex-start" }
          : { borderBottom: 0 }
      }
    >
      <div className="library-menu-items-header">
        {!IS_LIBRARY_EMPTY && (
          <TextField
            ref={searchInputRef}
            type="search"
            className={clsx("library-menu-items-container__search", {
              hideCancelButton: editorInterface.formFactor !== "phone",
            })}
            placeholder={t("library.search.inputPlaceholder")}
            value={searchInputValue}
            onChange={(value) => setSearchInputValue(value)}
          />
        )}
        <LibraryDropdownMenu
          selectedItems={selectedItems}
          onSelectItems={onSelectItems}
          className="library-menu-dropdown-container--in-heading"
        />
      </div>
      <Stack.Col
        className="library-menu-items-container__items"
        align="start"
        gap={1}
        style={{
          flex: publishedItems.length > 0 ? 1 : "0 1 auto",
          margin: IS_LIBRARY_EMPTY ? "auto" : 0,
        }}
        ref={libraryContainerRef}
      >
        {isLoading && (
          <div
            style={{
              position: "absolute",
              top: "var(--container-padding-y)",
              right: "var(--container-padding-x)",
              transform: "translateY(50%)",
            }}
          >
            <Spinner />
          </div>
        )}

        {JSX_whenNotSearching}
        {JSX_whenSearching}

        {IS_LIBRARY_EMPTY && (
          <LibraryMenuControlButtons
            style={{ padding: "16px 0", width: "100%" }}
            id={id}
            libraryReturnUrl={libraryReturnUrl}
            theme={theme}
          />
        )}
      </Stack.Col>
    </div>
  );
}

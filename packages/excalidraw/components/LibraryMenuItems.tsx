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

import { LibraryMenuControlButtons } from "./LibraryMenuControlButtons";
import { LibraryDropdownMenu } from "./LibraryMenuHeaderContent";
import {
  LibraryMenuSection,
  LibraryMenuSectionGrid,
} from "./LibraryMenuSection";

import Spinner from "./Spinner";
import Stack from "./Stack";

import "./LibraryMenuItems.scss";

import { TextField } from "./TextField";

import { useDevice } from "./App";

import { Button } from "./Button";

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
  onAddToLibrary: (elements: LibraryItem["elements"]) => void;
  libraryReturnUrl: ExcalidrawProps["libraryReturnUrl"];
  theme: UIAppState["theme"];
  id: string;
  selectedItems: LibraryItem["id"][];
  onSelectItems: (id: LibraryItem["id"][]) => void;
}) {
  const device = useDevice();
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

  const unpublishedItems = useMemo(
    () => libraryItems.filter((item) => item.status !== "published"),
    [libraryItems],
  );

  const publishedItems = useMemo(
    () => libraryItems.filter((item) => item.status === "published"),
    [libraryItems],
  );

  const onItemSelectToggle = useCallback(
    (id: LibraryItem["id"], event: React.MouseEvent) => {
      const shouldSelect = !selectedItems.includes(id);
      const orderedItems = [...unpublishedItems, ...publishedItems];
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

  const onAddToLibraryClick = useCallback(() => {
    onAddToLibrary(pendingElements);
  }, [pendingElements, onAddToLibrary]);

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
          {t("labels.personalLib")}
        </div>
      )}
      {!pendingElements.length && !unpublishedItems.length ? (
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
              onClick={onAddToLibraryClick}
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
      )}

      {publishedItems.length > 0 && (
        <div
          className="library-menu-items-container__header"
          style={{ marginTop: "0.75rem" }}
        >
          {t("labels.excalidrawLib")}
        </div>
      )}
      {publishedItems.length > 0 && (
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
              hideCancelButton: !device.editor.isMobile,
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

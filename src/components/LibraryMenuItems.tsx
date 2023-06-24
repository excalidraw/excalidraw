import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { MIME_TYPES } from "../constants";
import { serializeLibraryAsJSON } from "../data/json";
import { duplicateElements } from "../element/newElement";
import { useLibraryCache } from "../hooks/useLibraryItemSvg";
import { useScrollPosition } from "../hooks/useScrollPosition";
import { t } from "../i18n";
import {
  ExcalidrawProps,
  LibraryItem,
  LibraryItems,
  ObjecitveKinds,
  UIAppState,
} from "../types";
import { arrayToMap } from "../utils";
import { LibraryMenuControlButtons } from "./LibraryMenuControlButtons";
import { LibraryDropdownMenu } from "./LibraryMenuHeaderContent";
import {
  LibraryMenuSection,
  LibraryMenuSectionGrid,
} from "./LibraryMenuSection";
import Stack from "./Stack";

import "./LibraryMenuItems.scss";
import Spinner from "./Spinner";

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
  const libraryContainerRef = useRef<HTMLDivElement>(null);
  const scrollPosition = useScrollPosition<HTMLDivElement>(libraryContainerRef);

  // This effect has to be called only on first render, therefore  `scrollPosition` isn't in the dependency array
  useEffect(() => {
    if (scrollPosition > 0) {
      libraryContainerRef.current?.scrollTo(0, scrollPosition);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const { svgCache } = useLibraryCache();

  // VBRN objects as lib items
  const camerasLibItems = useMemo(
    () => libraryItems.filter((item) => item.kind === ObjecitveKinds.CAMERA),
    [libraryItems],
  );
  const charactersLibItems = useMemo(
    () => libraryItems.filter((item) => item.kind === ObjecitveKinds.CHARACTER),
    [libraryItems],
  );

  // UNUSED
  const publishedItems = useMemo(
    () => libraryItems.filter((item) => item.status === "published"),
    [libraryItems],
  );

  const showBtn = !libraryItems.length && !pendingElements.length;

  const isLibraryEmpty =
    !pendingElements.length &&
    !camerasLibItems.length &&
    !publishedItems.length;

  const [lastSelectedItem, setLastSelectedItem] = useState<
    LibraryItem["id"] | null
  >(null);

  const onItemSelectToggle = useCallback(
    (id: LibraryItem["id"], event: React.MouseEvent) => {
      const shouldSelect = !selectedItems.includes(id);

      const orderedItems = [...camerasLibItems, ...publishedItems];

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
          const nextSelectedIds = orderedItems.reduce(
            (acc: LibraryItem["id"][], item, idx) => {
              if (
                (idx >= rangeStart && idx <= rangeEnd) ||
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
      camerasLibItems,
    ],
  );

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
          elements: duplicateElements(item.elements, { randomizeSeed: true }),
        };
      });
    },
    [libraryItems, selectedItems],
  );

  const onItemDrag = useCallback(
    (id: LibraryItem["id"], event: React.DragEvent) => {
      event.dataTransfer.setData(
        MIME_TYPES.excalidrawlib,
        serializeLibraryAsJSON(getInsertedElements(id)),
      );
    },
    [getInsertedElements],
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
    svgCache.size >= libraryItems.length
      ? CACHED_ITEMS_RENDERED_PER_BATCH
      : ITEMS_RENDERED_PER_BATCH;

  return (
    <div
      className="library-menu-items-container"
      style={
        pendingElements.length ||
        camerasLibItems.length ||
        publishedItems.length
          ? { justifyContent: "flex-start" }
          : { borderBottom: 0 }
      }
    >
      {/*

      VBRN diable dropdown menu
      {!isLibraryEmpty && (
        <LibraryDropdownMenu
          selectedItems={selectedItems}
          onSelectItems={onSelectItems}
          className="library-menu-dropdown-container--in-heading"
        />
      )} */}

      <Stack.Col
        className="library-menu-items-container__items"
        align="start"
        gap={1}
        style={{
          flex: publishedItems.length > 0 ? 1 : "0 1 auto",
          marginBottom: 0,
        }}
        ref={libraryContainerRef}
      >
        {/* NAV lib items render */}
        {renderObjectiveLibItems(
          camerasLibItems,
          t("labels.libCameras", null, "Cameras"),
        )}
        {renderObjectiveLibItems(
          charactersLibItems,
          t("labels.libCharacters", null, "Characters"),
        )}

        {/* NAV lib items render (remote lib) UNUSED  */}
        {/* {publeshedLibItems()} */}

        {/* ??? What is that button for */}
        {showBtn && (
          <LibraryMenuControlButtons
            style={{ padding: "16px 0", width: "100%" }}
            id={id}
            libraryReturnUrl={libraryReturnUrl}
            theme={theme}
          >
            <LibraryDropdownMenu
              selectedItems={selectedItems}
              onSelectItems={onSelectItems}
            />
          </LibraryMenuControlButtons>
        )}
      </Stack.Col>
    </div>
  );

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  function publeshedLibItems() {
    return (
      <>
        {(publishedItems.length > 0 ||
          pendingElements.length > 0 ||
          camerasLibItems.length > 0) && (
          <div className="library-menu-items-container__header library-menu-items-container__header--excal">
            {/* TITLE */}
          </div>
        )}
        {publishedItems.length > 0 ? (
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
        ) : camerasLibItems.length > 0 ? (
          <div
            style={{
              margin: "1rem 0",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              width: "100%",
              fontSize: ".9rem",
            }}
          >
            {t("library.noItems")}
          </div>
        ) : null}
      </>
    );
  }

  function renderObjectiveLibItems(items: LibraryItem[], title: string) {
    return (
      <>
        {!isLibraryEmpty && (
          <div className="library-menu-items-container__header">
            {title} {/* VBRN lib title */}
          </div>
        )}
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
        {!pendingElements.length && !items.length ? (
          <div className="library-menu-items__no-items">
            <div className="library-menu-items__no-items__label">
              {t("library.noItems")}
            </div>
            <div className="library-menu-items__no-items__hint">
              {publishedItems.length > 0
                ? t("library.hint_emptyPrivateLibrary")
                : t("library.hint_emptyLibrary")}
            </div>
          </div>
        ) : (
          <LibraryMenuSectionGrid>
            {/*
            VBRN diable "add pending element to library"

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
            )} */}
            <LibraryMenuSection
              itemsRenderedPerBatch={itemsRenderedPerBatch}
              items={items}
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
  }
}

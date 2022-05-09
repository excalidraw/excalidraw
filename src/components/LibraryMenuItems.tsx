import { chunk } from "lodash";
import React, { useCallback, useState } from "react";
import { saveLibraryAsJSON } from "../data/json";
import Library from "../data/library";
import { ExcalidrawElement, NonDeleted } from "../element/types";
import { t } from "../i18n";
import {
  AppState,
  BinaryFiles,
  ExcalidrawProps,
  LibraryItem,
  LibraryItems,
} from "../types";
import { arrayToMap, muteFSAbortError } from "../utils";
import { useDeviceType } from "./App";
import ConfirmDialog from "./ConfirmDialog";
import { exportToFileIcon, load, publishIcon, trash } from "./icons";
import { LibraryUnit } from "./LibraryUnit";
import Stack from "./Stack";
import { ToolButton } from "./ToolButton";
import { Tooltip } from "./Tooltip";

import "./LibraryMenuItems.scss";
import { VERSIONS } from "../constants";
import Spinner from "./Spinner";
import { fileOpen } from "../data/filesystem";

const LibraryMenuItems = ({
  isLoading,
  libraryItems,
  onRemoveFromLibrary,
  onAddToLibrary,
  onInsertShape,
  pendingElements,
  theme,
  setAppState,
  libraryReturnUrl,
  library,
  files,
  id,
  selectedItems,
  onSelectItems,
  onPublish,
  resetLibrary,
}: {
  isLoading: boolean;
  libraryItems: LibraryItems;
  pendingElements: LibraryItem["elements"];
  onRemoveFromLibrary: () => void;
  onInsertShape: (elements: LibraryItem["elements"]) => void;
  onAddToLibrary: (elements: LibraryItem["elements"]) => void;
  theme: AppState["theme"];
  files: BinaryFiles;
  setAppState: React.Component<any, AppState>["setState"];
  libraryReturnUrl: ExcalidrawProps["libraryReturnUrl"];
  library: Library;
  id: string;
  selectedItems: LibraryItem["id"][];
  onSelectItems: (id: LibraryItem["id"][]) => void;
  onPublish: () => void;
  resetLibrary: () => void;
}) => {
  const renderRemoveLibAlert = useCallback(() => {
    const content = selectedItems.length
      ? t("alerts.removeItemsFromsLibrary", { count: selectedItems.length })
      : t("alerts.resetLibrary");
    const title = selectedItems.length
      ? t("confirmDialog.removeItemsFromLib")
      : t("confirmDialog.resetLibrary");
    return (
      <ConfirmDialog
        onConfirm={() => {
          if (selectedItems.length) {
            onRemoveFromLibrary();
          } else {
            resetLibrary();
          }
          setShowRemoveLibAlert(false);
        }}
        onCancel={() => {
          setShowRemoveLibAlert(false);
        }}
        title={title}
      >
        <p>{content}</p>
      </ConfirmDialog>
    );
  }, [selectedItems, onRemoveFromLibrary, resetLibrary]);

  const [showRemoveLibAlert, setShowRemoveLibAlert] = useState(false);

  const isMobile = useDeviceType().isMobile;

  const renderLibraryActions = () => {
    const itemsSelected = !!selectedItems.length;
    const items = itemsSelected
      ? libraryItems.filter((item) => selectedItems.includes(item.id))
      : libraryItems;
    const resetLabel = itemsSelected
      ? t("buttons.remove")
      : t("buttons.resetLibrary");
    return (
      <div className="library-actions">
        {(!itemsSelected || !isMobile) && (
          <ToolButton
            key="import"
            type="button"
            title={t("buttons.load")}
            aria-label={t("buttons.load")}
            icon={load}
            onClick={async () => {
              try {
                await fileOpen({
                  description: "Excalidraw library files",
                  // ToDo: Be over-permissive until https://bugs.webkit.org/show_bug.cgi?id=34442
                  // gets resolved. Else, iOS users cannot open `.excalidraw` files.
                  /*
                  extensions: [".json", ".excalidrawlib"],
                  */
                });
              } catch (error: any) {
                if (error?.name === "AbortError") {
                  console.warn(error);
                  return;
                }
                setAppState({ errorMessage: t("errors.importLibraryError") });
              }
            }}
            className="library-actions--load"
          />
        )}
        {!!items.length && (
          <>
            <ToolButton
              key="export"
              type="button"
              title={t("buttons.export")}
              aria-label={t("buttons.export")}
              icon={exportToFileIcon}
              onClick={async () => {
                const libraryItems = itemsSelected
                  ? items
                  : await library.getLatestLibrary();
                saveLibraryAsJSON(libraryItems)
                  .catch(muteFSAbortError)
                  .catch((error) => {
                    setAppState({ errorMessage: error.message });
                  });
              }}
              className="library-actions--export"
            >
              {selectedItems.length > 0 && (
                <span className="library-actions-counter">
                  {selectedItems.length}
                </span>
              )}
            </ToolButton>
            <ToolButton
              key="reset"
              type="button"
              title={resetLabel}
              aria-label={resetLabel}
              icon={trash}
              onClick={() => setShowRemoveLibAlert(true)}
              className="library-actions--remove"
            >
              {selectedItems.length > 0 && (
                <span className="library-actions-counter">
                  {selectedItems.length}
                </span>
              )}
            </ToolButton>
          </>
        )}
        {itemsSelected && !isPublished && (
          <Tooltip label={t("hints.publishLibrary")}>
            <ToolButton
              type="button"
              aria-label={t("buttons.publishLibrary")}
              label={t("buttons.publishLibrary")}
              icon={publishIcon}
              className="library-actions--publish"
              onClick={onPublish}
            >
              {!isMobile && <label>{t("buttons.publishLibrary")}</label>}
              {selectedItems.length > 0 && (
                <span className="library-actions-counter">
                  {selectedItems.length}
                </span>
              )}
            </ToolButton>
          </Tooltip>
        )}
      </div>
    );
  };

  const CELLS_PER_ROW = isMobile ? 4 : 6;

  const referrer =
    libraryReturnUrl || window.location.origin + window.location.pathname;
  const isPublished = selectedItems.some(
    (id) => libraryItems.find((item) => item.id === id)?.status === "published",
  );

  const [lastSelectedItem, setLastSelectedItem] = useState<
    LibraryItem["id"] | null
  >(null);

  const onItemSelectToggle = (
    id: LibraryItem["id"],
    event: React.MouseEvent,
  ) => {
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
  };

  const createLibraryItemCompo = (params: {
    item:
      | LibraryItem
      | /* pending library item */ {
          id: null;
          elements: readonly NonDeleted<ExcalidrawElement>[];
        }
      | null;
    onClick?: () => void;
    key: string;
  }) => {
    return (
      <Stack.Col key={params.key}>
        <LibraryUnit
          elements={params.item?.elements}
          files={files}
          isPending={!params.item?.id && !!params.item?.elements}
          onClick={params.onClick || (() => {})}
          id={params.item?.id || null}
          selected={!!params.item?.id && selectedItems.includes(params.item.id)}
          onToggle={onItemSelectToggle}
        />
      </Stack.Col>
    );
  };

  const renderLibrarySection = (
    items: (
      | LibraryItem
      | /* pending library item */ {
          id: null;
          elements: readonly NonDeleted<ExcalidrawElement>[];
        }
    )[],
  ) => {
    const _items = items.map((item) => {
      if (item.id) {
        return createLibraryItemCompo({
          item,
          onClick: () => onInsertShape(item.elements),
          key: item.id,
        });
      }
      return createLibraryItemCompo({
        key: "__pending__item__",
        item,
        onClick: () => onAddToLibrary(pendingElements),
      });
    });

    // ensure we render all empty cells if no items are present
    let rows = chunk(_items, CELLS_PER_ROW);
    if (!rows.length) {
      rows = [[]];
    }

    return rows.map((rowItems, index, rows) => {
      if (index === rows.length - 1) {
        // pad row with empty cells
        rowItems = rowItems.concat(
          new Array(CELLS_PER_ROW - rowItems.length)
            .fill(null)
            .map((_, index) => {
              return createLibraryItemCompo({
                key: `empty_${index}`,
                item: null,
              });
            }),
        );
      }
      return (
        <Stack.Row align="center" gap={1} key={index}>
          {rowItems}
        </Stack.Row>
      );
    });
  };

  const unpublishedItems = libraryItems.filter(
    (item) => item.status !== "published",
  );
  const publishedItems = libraryItems.filter(
    (item) => item.status === "published",
  );

  return (
    <div className="library-menu-items-container">
      {showRemoveLibAlert && renderRemoveLibAlert()}
      <div className="layer-ui__library-header" key="library-header">
        {renderLibraryActions()}
        {isLoading ? (
          <Spinner />
        ) : (
          <a
            href={`${process.env.REACT_APP_LIBRARY_URL}?target=${
              window.name || "_blank"
            }&referrer=${referrer}&useHash=true&token=${id}&theme=${theme}&version=${
              VERSIONS.excalidrawLibrary
            }`}
            target="_excalidraw_libraries"
          >
            {t("labels.libraries")}
          </a>
        )}
      </div>
      <Stack.Col
        className="library-menu-items-container__items"
        align="start"
        gap={1}
      >
        <>
          <div className="separator">{t("labels.personalLib")}</div>
          {renderLibrarySection([
            // append pending library item
            ...(pendingElements.length
              ? [{ id: null, elements: pendingElements }]
              : []),
            ...unpublishedItems,
          ])}
        </>

        <>
          <div className="separator">{t("labels.excalidrawLib")} </div>

          {renderLibrarySection(publishedItems)}
        </>
      </Stack.Col>
    </div>
  );
};

export default LibraryMenuItems;

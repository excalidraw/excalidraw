import { chunk } from "lodash";
import React, { useCallback, useState } from "react";
import { saveLibraryAsJSON, serializeLibraryAsJSON } from "../data/json";
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
import { MIME_TYPES, VERSIONS } from "../constants";
import Spinner from "./Spinner";
import { fileOpen } from "../data/filesystem";

import { SidebarLockButton } from "./SidebarLockButton";

const LibraryMenuItems = ({
  isLoading,
  libraryItems,
  onRemoveFromLibrary,
  onAddToLibrary,
  onInsertLibraryItems,
  pendingElements,
  theme,
  setAppState,
  appState,
  libraryReturnUrl,
  library,
  files,
  id,
  selectedItems,
  onSelectItems,
  onPublish,
  resetLibrary,
  isInsideSidebar,
}: {
  isLoading: boolean;
  libraryItems: LibraryItems;
  pendingElements: LibraryItem["elements"];
  onRemoveFromLibrary: () => void;
  onInsertLibraryItems: (libraryItems: LibraryItems) => void;
  onAddToLibrary: (elements: LibraryItem["elements"]) => void;
  theme: AppState["theme"];
  files: BinaryFiles;
  setAppState: React.Component<any, AppState>["setState"];
  appState: AppState;
  libraryReturnUrl: ExcalidrawProps["libraryReturnUrl"];
  library: Library;
  id: string;
  selectedItems: LibraryItem["id"][];
  onSelectItems: (id: LibraryItem["id"][]) => void;
  onPublish: () => void;
  resetLibrary: () => void;
  isInsideSidebar: boolean;
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
                await library.updateLibrary({
                  libraryItems: fileOpen({
                    description: "Excalidraw library files",
                    // ToDo: Be over-permissive until https://bugs.webkit.org/show_bug.cgi?id=34442
                    // gets resolved. Else, iOS users cannot open `.excalidraw` files.
                    /*
                    extensions: [".json", ".excalidrawlib"],
                    */
                  }),
                  merge: true,
                  openLibraryMenu: true,
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
        {itemsSelected && (
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

  const CELLS_PER_ROW = 4;

  const referrer =
    libraryReturnUrl || window.location.origin + window.location.pathname;

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

  const getInsertedElements = (id: string) => {
    let targetElements;
    if (selectedItems.includes(id)) {
      targetElements = libraryItems.filter((item) =>
        selectedItems.includes(item.id),
      );
    } else {
      targetElements = libraryItems.filter((item) => item.id === id);
    }
    return targetElements;
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
          onDrag={(id, event) => {
            event.dataTransfer.setData(
              MIME_TYPES.excalidrawlib,
              serializeLibraryAsJSON(getInsertedElements(id)),
            );
          }}
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
          onClick: () => onInsertLibraryItems(getInsertedElements(item.id)),
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

  const CLOSE_ICON = (
    <svg viewBox="0 0 128 128">
      <path
        fill="#000000"
        d="M81.5879028,64 L125.605715,19.9821876 C128.751004,16.8368988 128.754391,11.5017055 125.465832,8.21314718 L119.786853,2.53416752 C116.427547,-0.825138422 111.229116,-0.817018406 108.017812,2.39428484 L64,46.4120972 L19.9821876,2.39428484 C16.8368988,-0.751003978 11.5017055,-0.7543908 8.21314718,2.53416752 L2.53416752,8.21314718 C-0.825138422,11.5724531 -0.817018406,16.7708844 2.39428484,19.9821876 L46.4120972,64 L2.39428484,108.017812 C-0.751003978,111.163101 -0.7543908,116.498295 2.53416752,119.786853 L8.21314718,125.465832 C11.5724531,128.825138 16.7708844,128.817018 19.9821876,125.605715 L64,81.5879028 L108.017812,125.605715 C111.163101,128.751004 116.498295,128.754391 119.786853,125.465832 L125.465832,119.786853 C128.825138,116.427547 128.817018,111.229116 125.605715,108.017812 L81.5879028,64 L81.5879028,64 Z"
      ></path>
    </svg>
  );

  const renderLibraryHeader = () => {
    return (
      <>
        <div className="layer-ui__library-header" key="library-header">
          {renderLibraryActions()}
          {isInsideSidebar && (
            <>
              <div className="sidebar_lock_btn">
                <SidebarLockButton
                  title="toolBar.lock"
                  name="lock"
                  checked={appState.isLibraryMenuDocked}
                  onChange={() =>
                    setAppState({
                      isLibraryMenuDocked: !appState.isLibraryMenuDocked,
                    })
                  }
                />
              </div>
            </>
          )}
          {!isMobile && (
            <div className="ToolIcon__icon__close">
              <button
                className="Modal__close"
                onClick={() =>
                  setAppState({
                    isLibraryOpen: false,
                    isLibraryMenuDocked: false,
                  })
                }
                aria-label={t("buttons.close")}
              >
                {CLOSE_ICON}
              </button>
            </div>
          )}
        </div>
        <div className="library_url">
          {isLoading && !isInsideSidebar ? (
            <Spinner />
          ) : isMobile ? (
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
          ) : null}
        </div>
      </>
    );
  };

  const renderLibraryMenuItems = () => {
    return (
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
    );
  };

  const renderLibraryFooter = () => {
    return (
      <div className="library_items_add">
        {isLoading ? (
          <Spinner />
        ) : !isMobile ? (
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
        ) : null}
      </div>
    );
  };

  const mobileStyles = {
    height: "50vh",
    boxShadow: "none",
    borderLeft: "none",
  };

  return (
    <div
      className="library-menu-items-container"
      style={isMobile ? mobileStyles : {}}
    >
      {showRemoveLibAlert && renderRemoveLibAlert()}
      {renderLibraryHeader()}
      {renderLibraryMenuItems()}
      {!isMobile && renderLibraryFooter()}
    </div>
  );
};

export default LibraryMenuItems;

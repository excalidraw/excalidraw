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
import { useDevice } from "./App";
import ConfirmDialog from "./ConfirmDialog";
import { close, exportToFileIcon, load, publishIcon, trash } from "./icons";
import { LibraryUnit } from "./LibraryUnit";
import Stack from "./Stack";
import { ToolButton } from "./ToolButton";
import { Tooltip } from "./Tooltip";

import "./LibraryMenuItems.scss";
import { MIME_TYPES, VERSIONS } from "../constants";
import Spinner from "./Spinner";
import { fileOpen } from "../data/filesystem";

import { SidebarLockButton } from "./SidebarLockButton";
import { trackEvent } from "../analytics";

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
  const device = useDevice();
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
        {!itemsSelected && (
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
              {!device.isMobile && <label>{t("buttons.publishLibrary")}</label>}
              {selectedItems.length > 0 && (
                <span className="library-actions-counter">
                  {selectedItems.length}
                </span>
              )}
            </ToolButton>
          </Tooltip>
        )}
        {device.isMobile && (
          <div className="library-menu-browse-button--mobile">
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
          </div>
        )}
      </div>
    );
  };

  const CELLS_PER_ROW = device.isMobile && !device.isSmScreen ? 6 : 4;

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

  const renderLibraryHeader = () => {
    return (
      <>
        <div className="layer-ui__library-header" key="library-header">
          {renderLibraryActions()}
          {device.canDeviceFitSidebar && (
            <>
              <div className="layer-ui__sidebar-lock-button">
                <SidebarLockButton
                  checked={appState.isLibraryMenuDocked}
                  onChange={() => {
                    document
                      .querySelector(".layer-ui__wrapper")
                      ?.classList.add("animate");
                    const nextState = !appState.isLibraryMenuDocked;
                    setAppState({
                      isLibraryMenuDocked: nextState,
                    });
                    trackEvent(
                      "library",
                      `toggleLibraryDock (${nextState ? "dock" : "undock"})`,
                      `sidebar (${device.isMobile ? "mobile" : "desktop"})`,
                    );
                  }}
                />
              </div>
            </>
          )}
          {!device.isMobile && (
            <div className="ToolIcon__icon__close">
              <button
                className="Modal__close"
                onClick={() =>
                  setAppState({
                    isLibraryOpen: false,
                  })
                }
                aria-label={t("buttons.close")}
              >
                {close}
              </button>
            </div>
          )}
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
        style={{
          flex: publishedItems.length > 0 ? 1 : "0 0 auto",
          marginBottom: 0,
        }}
      >
        <>
          <div className="separator">
            {(pendingElements.length > 0 ||
              unpublishedItems.length > 0 ||
              publishedItems.length > 0) && (
              <div>{t("labels.personalLib")}</div>
            )}
            {isLoading && (
              <div
                style={{
                  marginLeft: "auto",
                  marginRight: "1rem",
                  display: "flex",
                  alignItems: "center",
                  fontWeight: "normal",
                }}
              >
                <div style={{ transform: "translateY(2px)" }}>
                  <Spinner />
                </div>
              </div>
            )}
          </div>
          {!pendingElements.length && !unpublishedItems.length ? (
            <div
              style={{
                height: 65,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                width: "100%",
                fontSize: ".9rem",
              }}
            >
              No items yet!
              <div
                style={{
                  margin: ".6rem 0",
                  fontSize: ".8em",
                  width: "70%",
                  textAlign: "center",
                }}
              >
                {publishedItems.length > 0
                  ? t("library.hint_emptyPrivateLibrary")
                  : t("library.hint_emptyLibrary")}
              </div>
            </div>
          ) : (
            renderLibrarySection([
              // append pending library item
              ...(pendingElements.length
                ? [{ id: null, elements: pendingElements }]
                : []),
              ...unpublishedItems,
            ])
          )}
        </>

        <>
          {(publishedItems.length > 0 ||
            (!device.isMobile &&
              (pendingElements.length > 0 || unpublishedItems.length > 0))) && (
            <div className="separator">{t("labels.excalidrawLib")}</div>
          )}
          {publishedItems.length > 0 && renderLibrarySection(publishedItems)}
        </>
      </Stack.Col>
    );
  };

  const renderLibraryFooter = () => {
    return (
      <a
        className="library-menu-browse-button"
        href={`${process.env.REACT_APP_LIBRARY_URL}?target=${
          window.name || "_blank"
        }&referrer=${referrer}&useHash=true&token=${id}&theme=${theme}&version=${
          VERSIONS.excalidrawLibrary
        }`}
        target="_excalidraw_libraries"
      >
        {t("labels.libraries")}
      </a>
    );
  };

  return (
    <div
      className="library-menu-items-container"
      style={
        device.isMobile
          ? {
              minHeight: "200px",
              maxHeight: "70vh",
            }
          : undefined
      }
    >
      {showRemoveLibAlert && renderRemoveLibAlert()}
      {renderLibraryHeader()}
      {renderLibraryMenuItems()}
      {!device.isMobile && renderLibraryFooter()}
    </div>
  );
};

export default LibraryMenuItems;

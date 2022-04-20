import { chunk } from "lodash";
import { useCallback, useState } from "react";
import { importLibraryFromJSON, saveLibraryAsJSON } from "../data/json";
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
import { muteFSAbortError } from "../utils";
import { useDeviceType } from "./App";
import ConfirmDialog from "./ConfirmDialog";
import { exportToFileIcon, load, publishIcon, trash } from "./icons";
import { LibraryUnit } from "./LibraryUnit";
import Stack from "./Stack";
import { ToolButton } from "./ToolButton";
import { Tooltip } from "./Tooltip";

import "./LibraryMenuItems.scss";
import { VERSIONS } from "../constants";

const LibraryMenuItems = ({
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
  onToggle,
  onPublish,
  resetLibrary,
}: {
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
  onToggle: (id: LibraryItem["id"], event: React.MouseEvent) => void;
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
            onClick={() => {
              importLibraryFromJSON(library)
                .catch(muteFSAbortError)
                .catch((error) => {
                  setAppState({ errorMessage: error.message });
                });
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
                  : await library.loadLibrary();
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
          onToggle={(id, event) => {
            onToggle(id, event);
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

  const publishedItems = libraryItems.filter(
    (item) => item.status === "published",
  );
  const unpublishedItems = [
    // append pending library item
    ...(pendingElements.length
      ? [{ id: null, elements: pendingElements }]
      : []),
    ...libraryItems.filter((item) => item.status !== "published"),
  ];

  return (
    <div className="library-menu-items-container">
      {showRemoveLibAlert && renderRemoveLibAlert()}
      <div className="layer-ui__library-header" key="library-header">
        {renderLibraryActions()}
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
      <Stack.Col
        className="library-menu-items-container__items"
        align="start"
        gap={1}
      >
        <>
          <div className="separator">{t("labels.personalLib")}</div>
          {renderLibrarySection(unpublishedItems)}
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

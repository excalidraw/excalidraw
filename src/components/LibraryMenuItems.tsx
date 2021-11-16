import { chunk } from "lodash";
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
import { useIsMobile } from "./App";
import { exportToFileIcon, load, publishIcon, trash } from "./icons";
import { LibraryUnit } from "./LibraryUnit";
import Stack from "./Stack";
import { ToolButton } from "./ToolButton";
import { Tooltip } from "./Tooltip";

const LibraryMenuItems = ({
  libraryItems,
  onRemoveFromLibrary,
  onAddToLibrary,
  onInsertShape,
  pendingElements,
  theme,
  setAppState,
  setLibraryItems,
  libraryReturnUrl,
  focusContainer,
  library,
  files,
  id,
  appState,
  selectedItems,
  onToggle,
  onPublish,
}: {
  libraryItems: LibraryItems;
  pendingElements: LibraryItem["elements"];
  onRemoveFromLibrary: () => void;
  onInsertShape: (elements: LibraryItem["elements"]) => void;
  onAddToLibrary: (elements: LibraryItem["elements"]) => void;
  theme: AppState["theme"];
  files: BinaryFiles;
  setAppState: React.Component<any, AppState>["setState"];
  setLibraryItems: (library: LibraryItems) => void;
  libraryReturnUrl: ExcalidrawProps["libraryReturnUrl"];
  focusContainer: () => void;
  library: Library;
  id: string;
  appState: AppState;
  selectedItems: LibraryItem["id"][];
  onToggle: (id: LibraryItem["id"]) => void;
  onPublish: () => void;
}) => {
  const isMobile = useIsMobile();

  const renderLibraryItemActions = () => {
    if (!selectedItems.length) {
      return null;
    }
    const items = libraryItems.filter((item) =>
      selectedItems.includes(item.id),
    );
    return (
      <div className="library-item-actions">
        <ToolButton
          key="export"
          type="button"
          title={t("buttons.export")}
          aria-label={t("buttons.export")}
          icon={exportToFileIcon}
          onClick={async () => {
            saveLibraryAsJSON(items)
              .catch(muteFSAbortError)
              .catch((error) => {
                setAppState({ errorMessage: error.message });
              });
          }}
          className="library-item-actions--export"
        />
        <ToolButton
          type="button"
          title={t("buttons.removeFromLibrary")}
          aria-label={t("buttons.removeFromLibrary")}
          label={t("buttons.removeFromLibrary")}
          icon={trash}
          onClick={onRemoveFromLibrary}
          className="library-item-actions--remove"
        />
        {!isPublished && (
          <Tooltip label={t("hints.publishLibrary")}>
            <ToolButton
              type="button"
              aria-label={t("buttons.publishLibrary")}
              label={t("buttons.publishLibrary")}
              icon={publishIcon}
              className="library-item-actions--publish"
              onClick={onPublish}
            />
          </Tooltip>
        )}
      </div>
    );
  };

  const renderLibraryActions = () => {
    if (selectedItems.length) {
      return null;
    }
    return (
      <div className="library-actions">
        <ToolButton
          key="import"
          type="button"
          title={t("buttons.load")}
          aria-label={t("buttons.load")}
          icon={load}
          onClick={() => {
            importLibraryFromJSON(library)
              .then(() => {
                // Close and then open to get the libraries updated
                setAppState({ isLibraryOpen: false });
                setAppState({ isLibraryOpen: true });
              })
              .catch(muteFSAbortError)
              .catch((error) => {
                setAppState({ errorMessage: error.message });
              });
          }}
        />
        {!!libraryItems && (
          <>
            <ToolButton
              key="export"
              type="button"
              title={t("buttons.export")}
              aria-label={t("buttons.export")}
              icon={exportToFileIcon}
              onClick={async () => {
                const libraryItems = await library.loadLibrary();
                saveLibraryAsJSON(libraryItems)
                  .catch(muteFSAbortError)
                  .catch((error) => {
                    setAppState({ errorMessage: error.message });
                  });
              }}
              className="library-actions--export"
            />
            <ToolButton
              key="reset"
              type="button"
              title={t("buttons.resetLibrary")}
              aria-label={t("buttons.resetLibrary")}
              icon={trash}
              onClick={() => {
                if (window.confirm(t("alerts.resetLibrary"))) {
                  library.resetLibrary();
                  setLibraryItems([]);
                  focusContainer();
                }
              }}
              className="library-actions--remove"
            />
          </>
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
          onToggle={() => {
            if (params.item?.id) {
              onToggle(params.item.id);
            }
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
    ...libraryItems.filter((item) => item.status !== "published"),
    // append pending library item
    ...(pendingElements.length
      ? [{ id: null, elements: pendingElements }]
      : []),
  ];

  return (
    <>
      <Stack.Col align="start" gap={1} className="layer-ui__library-items">
        <div className="layer-ui__library-header" key="library-header">
          {renderLibraryActions()}
          {renderLibraryItemActions()}
          <a
            href={`${process.env.REACT_APP_LIBRARY_URL}?target=${
              window.name || "_blank"
            }&referrer=${referrer}&useHash=true&token=${id}&theme=${theme}`}
            target="_excalidraw_libraries"
          >
            {t("labels.libraries")}
          </a>
        </div>
        {(publishedItems.length > 0 || !unpublishedItems.length) &&
          renderLibrarySection(publishedItems)}
        {unpublishedItems.length > 0 && (
          <>
            <div
              key="separator"
              style={{ margin: ".6em .2em", fontWeight: 500 }}
            >
              {t("labels.unpublishedItems")}
            </div>
            {renderLibrarySection(unpublishedItems)}
          </>
        )}
      </Stack.Col>
    </>
  );
};

export default LibraryMenuItems;

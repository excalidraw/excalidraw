import { useRef, useState, useEffect, useCallback, RefObject } from "react";
import { importLibraryFromJSON, saveLibraryAsJSON } from "../data/json";
import Library from "../data/library";
import { NonDeleted, ExcalidrawElement } from "../element/types";
import { t } from "../i18n";
import { randomId } from "../random";
import {
  LibraryItems,
  LibraryItem,
  AppState,
  BinaryFiles,
  ExcalidrawProps,
} from "../types";
import { muteFSAbortError, chunk } from "../utils";
import { useIsMobile } from "./App";
import { Dialog } from "./Dialog";
import { trash, publishIcon, load, exportFile } from "./icons";
import { Island } from "./Island";
import { LibraryUnit } from "./LibraryUnit";
import PublishLibrary from "./PublishLibrary";
import Stack from "./Stack";
import { ToolButton } from "./ToolButton";

import "./LibraryMenu.scss";

const useOnClickOutside = (
  ref: RefObject<HTMLElement>,
  cb: (event: MouseEvent) => void,
) => {
  useEffect(() => {
    const listener = (event: MouseEvent) => {
      if (!ref.current) {
        return;
      }

      if (
        event.target instanceof Element &&
        (ref.current.contains(event.target) ||
          !document.body.contains(event.target))
      ) {
        return;
      }

      cb(event);
    };
    document.addEventListener("pointerdown", listener, false);

    return () => {
      document.removeEventListener("pointerdown", listener);
    };
  }, [ref, cb]);
};

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
    return (
      <div className="library-item-actions">
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
          <ToolButton
            type="button"
            title={t("buttons.publishLibrary")}
            aria-label={t("buttons.publishLibrary")}
            label={t("buttons.publishLibrary")}
            icon={publishIcon}
            className="library-item-actions--publish"
            onClick={onPublish}
          />
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
              icon={exportFile}
              onClick={() => {
                saveLibraryAsJSON(library)
                  .catch(muteFSAbortError)
                  .catch((error) => {
                    setAppState({ errorMessage: error.message });
                  });
              }}
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
            href={`https://libraries.excalidraw.com?target=${
              window.name || "_blank"
            }&referrer=${referrer}&useHash=true&token=${id}&theme=${theme}`}
            target="_excalidraw_libraries"
          >
            {t("labels.libraries")}
          </a>
        </div>
        {renderLibrarySection(publishedItems)}
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

export const LibraryMenu = ({
  onClickOutside,
  onInsertShape,
  pendingElements,
  onAddToLibrary,
  theme,
  setAppState,
  files,
  libraryReturnUrl,
  focusContainer,
  library,
  id,
  appState,
}: {
  pendingElements: LibraryItem["elements"];
  onClickOutside: (event: MouseEvent) => void;
  onInsertShape: (elements: LibraryItem["elements"]) => void;
  onAddToLibrary: () => void;
  theme: AppState["theme"];
  files: BinaryFiles;
  setAppState: React.Component<any, AppState>["setState"];
  libraryReturnUrl: ExcalidrawProps["libraryReturnUrl"];
  focusContainer: () => void;
  library: Library;
  id: string;
  appState: AppState;
}) => {
  const ref = useRef<HTMLDivElement | null>(null);

  useOnClickOutside(ref, (event) => {
    // If click on the library icon, do nothing.
    if ((event.target as Element).closest(".ToolIcon_type_button__library")) {
      return;
    }
    onClickOutside(event);
  });

  const [libraryItems, setLibraryItems] = useState<LibraryItems>([]);

  const [loadingState, setIsLoading] = useState<
    "preloading" | "loading" | "ready"
  >("preloading");
  const [selectedItems, setSelectedItems] = useState<LibraryItem["id"][]>([]);
  const [showPublishLibraryDialog, setShowPublishLibraryDialog] =
    useState(false);
  const [publishLibSuccess, setPublishLibSuccess] = useState<null | {
    url: string;
    authorName: string;
  }>(null);
  const loadingTimerRef = useRef<number | null>(null);

  useEffect(() => {
    Promise.race([
      new Promise((resolve) => {
        loadingTimerRef.current = window.setTimeout(() => {
          resolve("loading");
        }, 100);
      }),
      library.loadLibrary().then((items) => {
        setLibraryItems(items);
        setIsLoading("ready");
      }),
    ]).then((data) => {
      if (data === "loading") {
        setIsLoading("loading");
      }
    });
    return () => {
      clearTimeout(loadingTimerRef.current!);
    };
  }, [library]);

  const removeFromLibrary = useCallback(async () => {
    const items = await library.loadLibrary();
    if (
      window.confirm(
        t("alerts.removeItemsFromsLibrary", { count: selectedItems.length }),
      )
    ) {
      const nextItems = items.filter(
        (item) => !selectedItems.includes(item.id),
      );
      library.saveLibrary(nextItems).catch((error) => {
        setLibraryItems(items);
        setAppState({ errorMessage: t("alerts.errorRemovingFromLibrary") });
      });
      setSelectedItems([]);
      setLibraryItems(nextItems);
    }
  }, [library, setAppState, selectedItems, setSelectedItems]);

  const addToLibrary = useCallback(
    async (elements: LibraryItem["elements"]) => {
      if (elements.some((element) => element.type === "image")) {
        return setAppState({
          errorMessage: "Support for adding images to the library coming soon!",
        });
      }
      const items = await library.loadLibrary();
      const nextItems: LibraryItems = [
        ...items,
        { status: "unpublished", elements, id: randomId() },
      ];
      onAddToLibrary();
      library.saveLibrary(nextItems).catch((error) => {
        setLibraryItems(items);
        setAppState({ errorMessage: t("alerts.errorAddingToLibrary") });
      });
      setLibraryItems(nextItems);
    },
    [onAddToLibrary, library, setAppState],
  );

  const renderPublishSuccess = useCallback(() => {
    return (
      <Dialog
        onCloseRequest={() => setPublishLibSuccess(null)}
        title={t("publishSuccessDialog.title")}
        className="publish-library-success"
        small={true}
      >
        <p>
          {t("publishSuccessDialog.content", {
            authorName: publishLibSuccess!.authorName,
          })}{" "}
          <a
            href={publishLibSuccess?.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t("publishSuccessDialog.link")}
          </a>
        </p>
        <ToolButton
          type="button"
          title={t("buttons.close")}
          aria-label={t("buttons.close")}
          label={t("buttons.close")}
          onClick={() => setPublishLibSuccess(null)}
          data-testid="publish-library-success-close"
          className="publish-library-success-close"
        />
      </Dialog>
    );
  }, [setPublishLibSuccess, publishLibSuccess]);

  const getSelectedItems = () =>
    libraryItems.filter((item) => selectedItems.includes(item.id));

  const onPublishLibSuccess = useCallback(
    (data) => {
      setShowPublishLibraryDialog(false);
      setPublishLibSuccess(data);
      const nextLibItems = libraryItems.slice();

      nextLibItems.forEach((libItem) => {
        if (selectedItems.includes(libItem.id)) {
          libItem.status = "published";
        }
      });
      library.saveLibrary(nextLibItems);
      setLibraryItems(nextLibItems);
    },
    [
      setShowPublishLibraryDialog,
      setPublishLibSuccess,
      libraryItems,
      setLibraryItems,
      selectedItems,
      library,
    ],
  );

  return loadingState === "preloading" ? null : (
    <Island padding={1} ref={ref} className="layer-ui__library">
      {showPublishLibraryDialog && (
        <PublishLibrary
          onClose={() => setShowPublishLibraryDialog(false)}
          libraryItems={getSelectedItems()}
          appState={appState}
          onSuccess={onPublishLibSuccess}
          onError={(error) => window.alert(error)}
        />
      )}
      {publishLibSuccess && renderPublishSuccess()}

      {loadingState === "loading" ? (
        <div className="layer-ui__library-message">
          {t("labels.libraryLoadingMessage")}
        </div>
      ) : (
        <LibraryMenuItems
          libraryItems={libraryItems}
          onRemoveFromLibrary={removeFromLibrary}
          onAddToLibrary={addToLibrary}
          onInsertShape={onInsertShape}
          pendingElements={pendingElements}
          setAppState={setAppState}
          setLibraryItems={setLibraryItems}
          libraryReturnUrl={libraryReturnUrl}
          focusContainer={focusContainer}
          library={library}
          theme={theme}
          files={files}
          id={id}
          appState={appState}
          selectedItems={selectedItems}
          onToggle={(id) => {
            if (!selectedItems.includes(id)) {
              setSelectedItems([...selectedItems, id]);
            } else {
              setSelectedItems(selectedItems.filter((_id) => _id !== id));
            }
          }}
          onPublish={() => setShowPublishLibraryDialog(true)}
        />
      )}
    </Island>
  );
};

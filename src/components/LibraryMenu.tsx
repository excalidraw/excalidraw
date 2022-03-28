import { useRef, useState, useEffect, useCallback, RefObject } from "react";
import Library from "../data/library";
import { t } from "../i18n";
import { randomId } from "../random";
import {
  LibraryItems,
  LibraryItem,
  AppState,
  BinaryFiles,
  ExcalidrawProps,
} from "../types";
import { Dialog } from "./Dialog";
import { Island } from "./Island";
import PublishLibrary from "./PublishLibrary";
import { ToolButton } from "./ToolButton";

import "./LibraryMenu.scss";
import LibraryMenuItems from "./LibraryMenuItems";
import { EVENT } from "../constants";
import { KEYS } from "../keys";
import { arrayToMap } from "../utils";
import { trackEvent } from "../analytics";

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

const getSelectedItems = (
  libraryItems: LibraryItems,
  selectedItems: LibraryItem["id"][],
) => libraryItems.filter((item) => selectedItems.includes(item.id));

export const LibraryMenu = ({
  onClose,
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
  onClose: () => void;
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
    if ((event.target as Element).closest(".ToolIcon__library")) {
      return;
    }
    onClose();
  });

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === KEYS.ESCAPE) {
        onClose();
      }
    };
    document.addEventListener(EVENT.KEYDOWN, handleKeyDown);
    return () => {
      document.removeEventListener(EVENT.KEYDOWN, handleKeyDown);
    };
  }, [onClose]);

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

    const nextItems = items.filter((item) => !selectedItems.includes(item.id));
    library.saveLibrary(nextItems).catch((error) => {
      setLibraryItems(items);
      setAppState({ errorMessage: t("alerts.errorRemovingFromLibrary") });
    });
    setSelectedItems([]);
    setLibraryItems(nextItems);
  }, [library, setAppState, selectedItems, setSelectedItems]);

  const resetLibrary = useCallback(() => {
    library.resetLibrary();
    setLibraryItems([]);
    focusContainer();
  }, [library, focusContainer]);

  const addToLibrary = useCallback(
    async (elements: LibraryItem["elements"]) => {
      trackEvent("element", "addToLibrary", "ui");
      if (elements.some((element) => element.type === "image")) {
        return setAppState({
          errorMessage: "Support for adding images to the library coming soon!",
        });
      }
      const items = await library.loadLibrary();
      const nextItems: LibraryItems = [
        {
          status: "unpublished",
          elements,
          id: randomId(),
          created: Date.now(),
        },
        ...items,
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

  const onPublishLibSuccess = useCallback(
    (data) => {
      setShowPublishLibraryDialog(false);
      setPublishLibSuccess({ url: data.url, authorName: data.authorName });
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
      selectedItems,
      library,
    ],
  );

  const [lastSelectedItem, setLastSelectedItem] = useState<
    LibraryItem["id"] | null
  >(null);

  return loadingState === "preloading" ? null : (
    <Island padding={1} ref={ref} className="layer-ui__library">
      {showPublishLibraryDialog && (
        <PublishLibrary
          onClose={() => setShowPublishLibraryDialog(false)}
          libraryItems={getSelectedItems(libraryItems, selectedItems)}
          appState={appState}
          onSuccess={onPublishLibSuccess}
          onError={(error) => window.alert(error)}
          updateItemsInStorage={() => library.saveLibrary(libraryItems)}
          onRemove={(id: string) =>
            setSelectedItems(selectedItems.filter((_id) => _id !== id))
          }
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
          libraryReturnUrl={libraryReturnUrl}
          library={library}
          theme={theme}
          files={files}
          id={id}
          selectedItems={selectedItems}
          onToggle={(id, event) => {
            const shouldSelect = !selectedItems.includes(id);

            if (shouldSelect) {
              if (event.shiftKey && lastSelectedItem) {
                const rangeStart = libraryItems.findIndex(
                  (item) => item.id === lastSelectedItem,
                );
                const rangeEnd = libraryItems.findIndex(
                  (item) => item.id === id,
                );

                if (rangeStart === -1 || rangeEnd === -1) {
                  setSelectedItems([...selectedItems, id]);
                  return;
                }

                const selectedItemsMap = arrayToMap(selectedItems);
                const nextSelectedIds = libraryItems.reduce(
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

                setSelectedItems(nextSelectedIds);
              } else {
                setSelectedItems([...selectedItems, id]);
              }
              setLastSelectedItem(id);
            } else {
              setLastSelectedItem(null);
              setSelectedItems(selectedItems.filter((_id) => _id !== id));
            }
          }}
          onPublish={() => setShowPublishLibraryDialog(true)}
          resetLibrary={resetLibrary}
        />
      )}
    </Island>
  );
};

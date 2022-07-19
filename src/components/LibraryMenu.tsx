import {
  useRef,
  useState,
  useEffect,
  useCallback,
  RefObject,
  forwardRef,
} from "react";
import Library, { libraryItemsAtom } from "../data/library";
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
import { trackEvent } from "../analytics";
import { useAtom } from "jotai";
import { jotaiScope } from "../jotai";
import Spinner from "./Spinner";
import { useDevice, useExcalidrawData } from "./App";

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

const LibraryMenuWrapper = forwardRef<
  HTMLDivElement,
  { children: React.ReactNode }
>(({ children }, ref) => {
  return (
    <Island padding={1} ref={ref} className="layer-ui__library">
      {children}
    </Island>
  );
});

export const LibraryMenu = ({
  onClose,
  onInsertLibraryItems,
  pendingElements,
  onAddToLibrary,
  setAppState,
  files,
  libraryReturnUrl,
  focusContainer,
  library,
  id,
}: {
  pendingElements: LibraryItem["elements"];
  onClose: () => void;
  onInsertLibraryItems: (libraryItems: LibraryItems) => void;
  onAddToLibrary: () => void;
  files: BinaryFiles;
  setAppState: React.Component<any, AppState>["setState"];
  libraryReturnUrl: ExcalidrawProps["libraryReturnUrl"];
  focusContainer: () => void;
  library: Library;
  id: string;
}) => {
  const ref = useRef<HTMLDivElement | null>(null);

  const device = useDevice();
  const { appState } = useExcalidrawData();
  useOnClickOutside(
    ref,
    useCallback(
      (event) => {
        // If click on the library icon, do nothing.
        if ((event.target as Element).closest(".ToolIcon__library")) {
          return;
        }
        if (!appState.isLibraryMenuDocked || !device.canDeviceFitSidebar) {
          onClose();
        }
      },
      [onClose, appState.isLibraryMenuDocked, device.canDeviceFitSidebar],
    ),
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === KEYS.ESCAPE &&
        (!appState.isLibraryMenuDocked || !device.canDeviceFitSidebar)
      ) {
        onClose();
      }
    };
    document.addEventListener(EVENT.KEYDOWN, handleKeyDown);
    return () => {
      document.removeEventListener(EVENT.KEYDOWN, handleKeyDown);
    };
  }, [onClose, appState.isLibraryMenuDocked, device.canDeviceFitSidebar]);

  const [selectedItems, setSelectedItems] = useState<LibraryItem["id"][]>([]);
  const [showPublishLibraryDialog, setShowPublishLibraryDialog] =
    useState(false);
  const [publishLibSuccess, setPublishLibSuccess] = useState<null | {
    url: string;
    authorName: string;
  }>(null);

  const [libraryItemsData] = useAtom(libraryItemsAtom, jotaiScope);

  const removeFromLibrary = useCallback(
    async (libraryItems: LibraryItems) => {
      const nextItems = libraryItems.filter(
        (item) => !selectedItems.includes(item.id),
      );
      library.setLibrary(nextItems).catch(() => {
        setAppState({ errorMessage: t("alerts.errorRemovingFromLibrary") });
      });
      setSelectedItems([]);
    },
    [library, setAppState, selectedItems, setSelectedItems],
  );

  const resetLibrary = useCallback(() => {
    library.resetLibrary();
    focusContainer();
  }, [library, focusContainer]);

  const addToLibrary = useCallback(
    async (elements: LibraryItem["elements"], libraryItems: LibraryItems) => {
      trackEvent("element", "addToLibrary", "ui");
      if (elements.some((element) => element.type === "image")) {
        return setAppState({
          errorMessage: "Support for adding images to the library coming soon!",
        });
      }
      const nextItems: LibraryItems = [
        {
          status: "unpublished",
          elements,
          id: randomId(),
          created: Date.now(),
        },
        ...libraryItems,
      ];
      onAddToLibrary();
      library.setLibrary(nextItems).catch(() => {
        setAppState({ errorMessage: t("alerts.errorAddingToLibrary") });
      });
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
    (data, libraryItems: LibraryItems) => {
      setShowPublishLibraryDialog(false);
      setPublishLibSuccess({ url: data.url, authorName: data.authorName });
      const nextLibItems = libraryItems.slice();
      nextLibItems.forEach((libItem) => {
        if (selectedItems.includes(libItem.id)) {
          libItem.status = "published";
        }
      });
      library.setLibrary(nextLibItems);
    },
    [setShowPublishLibraryDialog, setPublishLibSuccess, selectedItems, library],
  );

  if (
    libraryItemsData.status === "loading" &&
    !libraryItemsData.isInitialized
  ) {
    return (
      <LibraryMenuWrapper ref={ref}>
        <div className="layer-ui__library-message">
          <Spinner size="2em" />
          <span>{t("labels.libraryLoadingMessage")}</span>
        </div>
      </LibraryMenuWrapper>
    );
  }

  return (
    <LibraryMenuWrapper ref={ref}>
      {showPublishLibraryDialog && (
        <PublishLibrary
          onClose={() => setShowPublishLibraryDialog(false)}
          libraryItems={getSelectedItems(
            libraryItemsData.libraryItems,
            selectedItems,
          )}
          appState={appState}
          onSuccess={(data) =>
            onPublishLibSuccess(data, libraryItemsData.libraryItems)
          }
          onError={(error) => window.alert(error)}
          updateItemsInStorage={() =>
            library.setLibrary(libraryItemsData.libraryItems)
          }
          onRemove={(id: string) =>
            setSelectedItems(selectedItems.filter((_id) => _id !== id))
          }
        />
      )}
      {publishLibSuccess && renderPublishSuccess()}
      <LibraryMenuItems
        isLoading={libraryItemsData.status === "loading"}
        libraryItems={libraryItemsData.libraryItems}
        onRemoveFromLibrary={() =>
          removeFromLibrary(libraryItemsData.libraryItems)
        }
        onAddToLibrary={(elements) =>
          addToLibrary(elements, libraryItemsData.libraryItems)
        }
        onInsertLibraryItems={onInsertLibraryItems}
        pendingElements={pendingElements}
        setAppState={setAppState}
        appState={appState}
        libraryReturnUrl={libraryReturnUrl}
        library={library}
        theme={appState.theme}
        files={files}
        id={id}
        selectedItems={selectedItems}
        onSelectItems={(ids) => setSelectedItems(ids)}
        onPublish={() => setShowPublishLibraryDialog(true)}
        resetLibrary={resetLibrary}
      />
    </LibraryMenuWrapper>
  );
};

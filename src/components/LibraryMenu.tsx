import {
  useRef,
  useState,
  useEffect,
  useCallback,
  RefObject,
  forwardRef,
} from "react";
import Library, {
  distributeLibraryItemsOnSquareGrid,
  libraryItemsAtom,
} from "../data/library";
import { t } from "../i18n";
import { randomId } from "../random";
import { LibraryItems, LibraryItem, AppState, ExcalidrawProps } from "../types";

import "./LibraryMenu.scss";
import LibraryMenuItems from "./LibraryMenuItems";
import { EVENT } from "../constants";
import { KEYS } from "../keys";
import { trackEvent } from "../analytics";
import { useAtom } from "jotai";
import { jotaiScope } from "../jotai";
import Spinner from "./Spinner";
import {
  useDevice,
  useExcalidrawElements,
  useExcalidrawSetAppState,
} from "./App";
import { Sidebar } from "./Sidebar/Sidebar";
import { getSelectedElements } from "../scene";
import { NonDeletedExcalidrawElement } from "../element/types";
import { LibraryMenuHeader } from "./LibraryMenuHeaderContent";
import LibraryMenuBrowseButton from "./LibraryMenuBrowseButton";

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

const LibraryMenuWrapper = forwardRef<
  HTMLDivElement,
  { children: React.ReactNode }
>(({ children }, ref) => {
  return (
    <div ref={ref} className="layer-ui__library">
      {children}
    </div>
  );
});

export const LibraryMenuContent = ({
  onInsertLibraryItems,
  pendingElements,
  onAddToLibrary,
  setAppState,
  libraryReturnUrl,
  library,
  id,
  appState,
  selectedItems,
  onSelectItems,
}: {
  pendingElements: LibraryItem["elements"];
  onInsertLibraryItems: (libraryItems: LibraryItems) => void;
  onAddToLibrary: () => void;
  setAppState: React.Component<any, AppState>["setState"];
  libraryReturnUrl: ExcalidrawProps["libraryReturnUrl"];
  library: Library;
  id: string;
  appState: AppState;
  selectedItems: LibraryItem["id"][];
  onSelectItems: (id: LibraryItem["id"][]) => void;
}) => {
  const [libraryItemsData] = useAtom(libraryItemsAtom, jotaiScope);

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

  if (
    libraryItemsData.status === "loading" &&
    !libraryItemsData.isInitialized
  ) {
    return (
      <LibraryMenuWrapper>
        <div className="layer-ui__library-message">
          <div>
            <Spinner size="2em" />
            <span>{t("labels.libraryLoadingMessage")}</span>
          </div>
        </div>
      </LibraryMenuWrapper>
    );
  }

  const showBtn =
    libraryItemsData.libraryItems.length > 0 || pendingElements.length > 0;

  return (
    <LibraryMenuWrapper>
      <LibraryMenuItems
        isLoading={libraryItemsData.status === "loading"}
        libraryItems={libraryItemsData.libraryItems}
        onAddToLibrary={(elements) =>
          addToLibrary(elements, libraryItemsData.libraryItems)
        }
        onInsertLibraryItems={onInsertLibraryItems}
        pendingElements={pendingElements}
        selectedItems={selectedItems}
        onSelectItems={onSelectItems}
        id={id}
        libraryReturnUrl={libraryReturnUrl}
        theme={appState.theme}
      />
      {showBtn && (
        <LibraryMenuBrowseButton
          id={id}
          libraryReturnUrl={libraryReturnUrl}
          theme={appState.theme}
        />
      )}
    </LibraryMenuWrapper>
  );
};

export const LibraryMenu: React.FC<{
  appState: AppState;
  onInsertElements: (elements: readonly NonDeletedExcalidrawElement[]) => void;
  libraryReturnUrl: ExcalidrawProps["libraryReturnUrl"];
  focusContainer: () => void;
  library: Library;
  id: string;
}> = ({
  appState,
  onInsertElements,
  libraryReturnUrl,
  focusContainer,
  library,
  id,
}) => {
  const setAppState = useExcalidrawSetAppState();
  const elements = useExcalidrawElements();
  const device = useDevice();

  const [selectedItems, setSelectedItems] = useState<LibraryItem["id"][]>([]);
  const [libraryItemsData] = useAtom(libraryItemsAtom, jotaiScope);

  const ref = useRef<HTMLDivElement | null>(null);

  const closeLibrary = useCallback(() => {
    const isDialogOpen = !!document.querySelector(".Dialog");

    // Prevent closing if any dialog is open
    if (isDialogOpen) {
      return;
    }
    setAppState({ openSidebar: null });
  }, [setAppState]);

  useOnClickOutside(
    ref,
    useCallback(
      (event) => {
        // If click on the library icon, do nothing so that LibraryButton
        // can toggle library menu
        if ((event.target as Element).closest(".ToolIcon__library")) {
          return;
        }
        if (!appState.isSidebarDocked || !device.canDeviceFitSidebar) {
          closeLibrary();
        }
      },
      [closeLibrary, appState.isSidebarDocked, device.canDeviceFitSidebar],
    ),
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === KEYS.ESCAPE &&
        (!appState.isSidebarDocked || !device.canDeviceFitSidebar)
      ) {
        closeLibrary();
      }
    };
    document.addEventListener(EVENT.KEYDOWN, handleKeyDown);
    return () => {
      document.removeEventListener(EVENT.KEYDOWN, handleKeyDown);
    };
  }, [closeLibrary, appState.isSidebarDocked, device.canDeviceFitSidebar]);

  const deselectItems = useCallback(() => {
    setAppState({
      selectedElementIds: {},
      selectedGroupIds: {},
    });
  }, [setAppState]);

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

  return (
    <Sidebar
      __isInternal
      // necessary to remount when switching between internal
      // and custom (host app) sidebar, so that the `props.onClose`
      // is colled correctly
      key="library"
      className="layer-ui__library-sidebar"
      initialDockedState={appState.isSidebarDocked}
      onDock={(docked) => {
        trackEvent(
          "library",
          `toggleLibraryDock (${docked ? "dock" : "undock"})`,
          `sidebar (${device.isMobile ? "mobile" : "desktop"})`,
        );
      }}
      ref={ref}
    >
      <Sidebar.Header className="layer-ui__library-header">
        <LibraryMenuHeader
          appState={appState}
          setAppState={setAppState}
          selectedItems={selectedItems}
          onSelectItems={setSelectedItems}
          library={library}
          onRemoveFromLibrary={() =>
            removeFromLibrary(libraryItemsData.libraryItems)
          }
          resetLibrary={resetLibrary}
        />
      </Sidebar.Header>
      <LibraryMenuContent
        pendingElements={getSelectedElements(elements, appState, true)}
        onInsertLibraryItems={(libraryItems) => {
          onInsertElements(distributeLibraryItemsOnSquareGrid(libraryItems));
        }}
        onAddToLibrary={deselectItems}
        setAppState={setAppState}
        libraryReturnUrl={libraryReturnUrl}
        library={library}
        id={id}
        appState={appState}
        selectedItems={selectedItems}
        onSelectItems={setSelectedItems}
      />
    </Sidebar>
  );
};

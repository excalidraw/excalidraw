import React, {
  useState,
  useCallback,
  useMemo,
  useEffect,
  memo,
  useRef,
} from "react";

import {
  LIBRARY_DISABLED_TYPES,
  randomId,
  isShallowEqual,
} from "@excalidraw/common";

import type {
  ExcalidrawElement,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";

import { trackEvent } from "../analytics";
import { useUIAppState } from "../context/ui-appState";
import {
  distributeLibraryItemsOnSquareGrid,
  libraryItemsAtom,
} from "../data/library";
import { atom, useAtom } from "../editor-jotai";
import { t } from "../i18n";

import { getSelectedElements } from "../scene";

import {
  useApp,
  useAppProps,
  useExcalidrawElements,
  useExcalidrawSetAppState,
} from "./App";
import { LibraryMenuControlButtons } from "./LibraryMenuControlButtons";
import LibraryMenuItems from "./LibraryMenuItems";
import Spinner from "./Spinner";

import "./LibraryMenu.scss";

import type {
  LibraryItems,
  LibraryItem,
  ExcalidrawProps,
  UIAppState,
  AppClassProperties,
} from "../types";
import type Library from "../data/library";

export const isLibraryMenuOpenAtom = atom(false);

const LibraryMenuWrapper = ({ children }: { children: React.ReactNode }) => {
  return <div className="layer-ui__library">{children}</div>;
};

const LibraryMenuContent = memo(
  ({
    onInsertLibraryItems,
    pendingElements,
    onAddToLibrary,
    setAppState,
    libraryReturnUrl,
    library,
    id,
    theme,
    selectedItems,
    onSelectItems,
  }: {
    pendingElements: LibraryItem["elements"];
    onInsertLibraryItems: (libraryItems: LibraryItems) => void;
    onAddToLibrary: () => void;
    setAppState: React.Component<any, UIAppState>["setState"];
    libraryReturnUrl: ExcalidrawProps["libraryReturnUrl"];
    library: Library;
    id: string;
    theme: UIAppState["theme"];
    selectedItems: LibraryItem["id"][];
    onSelectItems: (id: LibraryItem["id"][]) => void;
  }) => {
    const [libraryItemsData] = useAtom(libraryItemsAtom);

    const _onAddToLibrary = useCallback(
      (elements: LibraryItem["elements"]) => {
        const addToLibrary = async (
          processedElements: LibraryItem["elements"],
          libraryItems: LibraryItems,
        ) => {
          trackEvent("element", "addToLibrary", "ui");
          for (const type of LIBRARY_DISABLED_TYPES) {
            if (processedElements.some((element) => element.type === type)) {
              return setAppState({
                errorMessage: t(`errors.libraryElementTypeError.${type}`),
              });
            }
          }
          const nextItems: LibraryItems = [
            {
              status: "unpublished",
              elements: processedElements,
              id: randomId(),
              created: Date.now(),
            },
            ...libraryItems,
          ];
          onAddToLibrary();
          library.setLibrary(nextItems).catch(() => {
            setAppState({ errorMessage: t("alerts.errorAddingToLibrary") });
          });
        };
        addToLibrary(elements, libraryItemsData.libraryItems);
      },
      [onAddToLibrary, library, setAppState, libraryItemsData.libraryItems],
    );

    const libraryItems = useMemo(
      () => libraryItemsData.libraryItems,
      [libraryItemsData],
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
          libraryItems={libraryItems}
          onAddToLibrary={_onAddToLibrary}
          onInsertLibraryItems={onInsertLibraryItems}
          pendingElements={pendingElements}
          id={id}
          libraryReturnUrl={libraryReturnUrl}
          theme={theme}
          onSelectItems={onSelectItems}
          selectedItems={selectedItems}
        />
        {showBtn && (
          <LibraryMenuControlButtons
            className="library-menu-control-buttons--at-bottom"
            style={{ padding: "16px 12px 0 12px" }}
            id={id}
            libraryReturnUrl={libraryReturnUrl}
            theme={theme}
          />
        )}
      </LibraryMenuWrapper>
    );
  },
);

const getPendingElements = (
  elements: readonly NonDeletedExcalidrawElement[],
  selectedElementIds: UIAppState["selectedElementIds"],
) => ({
  elements,
  pending: getSelectedElements(
    elements,
    { selectedElementIds },
    {
      includeBoundTextElement: true,
      includeElementsInFrames: true,
    },
  ),
  selectedElementIds,
});

const usePendingElementsMemo = (
  appState: UIAppState,
  app: AppClassProperties,
) => {
  const elements = useExcalidrawElements();
  const [state, setState] = useState(() =>
    getPendingElements(elements, appState.selectedElementIds),
  );

  const selectedElementVersions = useRef(
    new Map<ExcalidrawElement["id"], ExcalidrawElement["version"]>(),
  );

  useEffect(() => {
    for (const element of state.pending) {
      selectedElementVersions.current.set(element.id, element.version);
    }
  }, [state.pending]);

  useEffect(() => {
    if (
      // Only update once pointer is released.
      // Reading directly from app.state to make it clear it's not reactive
      // (hence, there's potential for stale state)
      app.state.cursorButton === "up" &&
      app.state.activeTool.type === "selection"
    ) {
      setState((prev) => {
        // if selectedElementIds changed, we don't have to compare versions
        // ---------------------------------------------------------------------
        if (
          !isShallowEqual(prev.selectedElementIds, appState.selectedElementIds)
        ) {
          selectedElementVersions.current.clear();
          return getPendingElements(elements, appState.selectedElementIds);
        }
        // otherwise we need to check whether selected elements changed
        // ---------------------------------------------------------------------
        const elementsMap = app.scene.getNonDeletedElementsMap();
        for (const id of Object.keys(appState.selectedElementIds)) {
          const currVersion = elementsMap.get(id)?.version;
          if (
            currVersion &&
            currVersion !== selectedElementVersions.current.get(id)
          ) {
            // we can't update the selectedElementVersions in here
            // because of double render in StrictMode which would overwrite
            // the state in the second pass with the old `prev` state.
            // Thus, we update versions in a separate effect. May create
            // a race condition since current effect is not fully reactive.
            return getPendingElements(elements, appState.selectedElementIds);
          }
        }
        // nothing changed
        // ---------------------------------------------------------------------
        return prev;
      });
    }
  }, [
    app,
    app.state.cursorButton,
    app.state.activeTool.type,
    appState.selectedElementIds,
    elements,
  ]);

  return state.pending;
};

/**
 * This component is meant to be rendered inside <Sidebar.Tab/> inside our
 * <DefaultSidebar/> or host apps Sidebar components.
 */
export const LibraryMenu = memo(() => {
  const app = useApp();
  const { onInsertElements } = app;
  const appProps = useAppProps();
  const appState = useUIAppState();
  const setAppState = useExcalidrawSetAppState();
  const [selectedItems, setSelectedItems] = useState<LibraryItem["id"][]>([]);
  const memoizedLibrary = useMemo(() => app.library, [app.library]);
  const pendingElements = usePendingElementsMemo(appState, app);

  const onInsertLibraryItems = useCallback(
    (libraryItems: LibraryItems) => {
      onInsertElements(distributeLibraryItemsOnSquareGrid(libraryItems));
    },
    [onInsertElements],
  );

  const deselectItems = useCallback(() => {
    setAppState({
      selectedElementIds: {},
      selectedGroupIds: {},
      activeEmbeddable: null,
    });
  }, [setAppState]);

  return (
    <LibraryMenuContent
      pendingElements={pendingElements}
      onInsertLibraryItems={onInsertLibraryItems}
      onAddToLibrary={deselectItems}
      setAppState={setAppState}
      libraryReturnUrl={appProps.libraryReturnUrl}
      library={memoizedLibrary}
      id={app.id}
      theme={appState.theme}
      selectedItems={selectedItems}
      onSelectItems={setSelectedItems}
    />
  );
});

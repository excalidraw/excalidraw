import React, {
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
  memo,
} from "react";
import type Library from "../data/library";
import {
  distributeLibraryItemsOnSquareGrid,
  libraryItemsAtom,
} from "../data/library";
import { t } from "../i18n";
import { randomId } from "../random";
import type {
  LibraryItems,
  LibraryItem,
  ExcalidrawProps,
  UIAppState,
  AppState,
} from "../types";
import LibraryMenuItems from "./LibraryMenuItems";
import { trackEvent } from "../analytics";
import { atom, useAtom } from "../editor-jotai";
import Spinner from "./Spinner";
import {
  useApp,
  useAppProps,
  useExcalidrawElements,
  useExcalidrawSetAppState,
} from "./App";
import { getSelectedElements } from "../scene";
import { useUIAppState } from "../context/ui-appState";

import "./LibraryMenu.scss";
import { LibraryMenuControlButtons } from "./LibraryMenuControlButtons";
import { isShallowEqual } from "../utils";
import type { NonDeletedExcalidrawElement } from "../element/types";
import { LIBRARY_DISABLED_TYPES } from "../constants";

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

const usePendingElementsMemo = (appState: UIAppState) => {
  const elements = useExcalidrawElements();
  const hasSelectedChangedRef = useRef(false);

  const [state, setState] = useState(() =>
    getPendingElements(elements, appState.selectedElementIds),
  );

  const cursorButton =
    "cursorButton" in appState
      ? (appState.cursorButton as AppState["cursorButton"])
      : "up";
  const activeToolType = appState.activeTool.type;
  const edititingTextElement = appState.editingTextElement;

  useEffect(() => {
    if (cursorButton === "up" && activeToolType === "selection") {
      if (edititingTextElement) {
        setState({
          pending: [],
          elements,
          selectedElementIds: appState.selectedElementIds,
        });
        return;
      }
      const hasChanged = hasSelectedChangedRef.current;
      setState((prev) =>
        !hasChanged &&
        isShallowEqual(prev.selectedElementIds, appState.selectedElementIds)
          ? prev
          : getPendingElements(elements, appState.selectedElementIds),
      );
    }
    hasSelectedChangedRef.current = appState.isRotating || appState.isResizing;
  }, [
    appState.selectedElementIds,
    elements,
    cursorButton,
    activeToolType,
    appState.isRotating,
    appState.isResizing,
    edititingTextElement,
  ]);

  return state.pending;
};

/**
 * This component is meant to be rendered inside <Sidebar.Tab/> inside our
 * <DefaultSidebar/> or host apps Sidebar components.
 */
export const LibraryMenu = memo(() => {
  const { library, id, onInsertElements } = useApp();
  const appProps = useAppProps();
  const appState = useUIAppState();
  const setAppState = useExcalidrawSetAppState();
  const [selectedItems, setSelectedItems] = useState<LibraryItem["id"][]>([]);
  const memoizedLibrary = useMemo(() => library, [library]);
  // BUG: pendingElements are still causing some unnecessary rerenders because clicking into canvas returns some ids even when no element is selected.
  const pendingElements = usePendingElementsMemo(appState);

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
      id={id}
      theme={appState.theme}
      selectedItems={selectedItems}
      onSelectItems={setSelectedItems}
    />
  );
});

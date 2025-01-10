import React, { useState, useCallback, useMemo, useRef } from "react";
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
} from "../types";
import LibraryMenuItems from "./LibraryMenuItems";
import { trackEvent } from "../analytics";
import { atom, useAtom } from "jotai";
import { jotaiScope } from "../jotai";
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

export const LibraryMenuContent = ({
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
  const [libraryItemsData] = useAtom(libraryItemsAtom, jotaiScope);

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
};

const usePendingElementsMemo = (
  appState: UIAppState,
  elements: readonly NonDeletedExcalidrawElement[],
) => {
  const create = () =>
    getSelectedElements(elements, appState, {
      includeBoundTextElement: true,
      includeElementsInFrames: true,
    });
  const val = useRef(create());
  const prevAppState = useRef<UIAppState>(appState);
  const prevElements = useRef(elements);

  if (
    !isShallowEqual(
      appState.selectedElementIds,
      prevAppState.current.selectedElementIds,
    ) ||
    !isShallowEqual(elements, prevElements.current)
  ) {
    val.current = create();
    prevAppState.current = appState;
    prevElements.current = elements;
  }
  return val.current;
};

/**
 * This component is meant to be rendered inside <Sidebar.Tab/> inside our
 * <DefaultSidebar/> or host apps Sidebar components.
 */
export const LibraryMenu = () => {
  const { library, id, onInsertElements } = useApp();
  const appProps = useAppProps();
  const appState = useUIAppState();
  const setAppState = useExcalidrawSetAppState();
  const elements = useExcalidrawElements();
  const [selectedItems, setSelectedItems] = useState<LibraryItem["id"][]>([]);
  const memoizedLibrary = useMemo(() => library, [library]);
  // BUG: pendingElements are still causing some unnecessary rerenders because clicking into canvas returns some ids even when no element is selected.
  const pendingElements = usePendingElementsMemo(appState, elements);

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
};

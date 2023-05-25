import React, { useState, useCallback, useMemo, useRef } from "react";
import Library, {
  distributeLibraryItemsOnSquareGrid,
  libraryItemsAtom,
} from "../data/library";
import { t } from "../i18n";
import { randomId } from "../random";
import {
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
import { NonDeletedExcalidrawElement } from "../element/types";

export const isLibraryMenuOpenAtom = atom(false);

const LibraryMenuWrapper = ({ children }: { children: React.ReactNode }) => {
  return <div className="layer-ui__library">{children}</div>;
};

export const LibraryMenuContent = ({
  onInsertLibraryItems,
  pendingElements,
  onAddToLibraryCallback,
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
  onAddToLibraryCallback: () => void;
  setAppState: React.Component<any, UIAppState>["setState"];
  libraryReturnUrl: ExcalidrawProps["libraryReturnUrl"];
  library: Library;
  id: string;
  theme: UIAppState["theme"];
  selectedItems: LibraryItem["id"][];
  onSelectItems: (id: LibraryItem["id"][]) => void;
}) => {
  const [libraryItemsData] = useAtom(libraryItemsAtom, jotaiScope);

  const onAddToLibrary = useCallback(
    (elements: LibraryItem["elements"]) => {
      const addToLibrary = async (
        processedElements: LibraryItem["elements"],
        libraryItems: LibraryItems,
      ) => {
        trackEvent("element", "addToLibrary", "ui");
        if (processedElements.some((element) => element.type === "image")) {
          return setAppState({
            errorMessage:
              "Support for adding images to the library coming soon!",
          });
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
        onAddToLibraryCallback();
        library.setLibrary(nextItems).catch(() => {
          setAppState({ errorMessage: t("alerts.errorAddingToLibrary") });
        });
      };
      addToLibrary(elements, libraryItemsData.libraryItems);
    },
    [
      onAddToLibraryCallback,
      library,
      setAppState,
      libraryItemsData.libraryItems,
    ],
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
        onAddToLibrary={onAddToLibrary}
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
  const create = () => getSelectedElements(elements, appState, true);
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
    });
  }, [setAppState]);

  return (
    <LibraryMenuContent
      pendingElements={pendingElements}
      onInsertLibraryItems={onInsertLibraryItems}
      onAddToLibraryCallback={deselectItems}
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

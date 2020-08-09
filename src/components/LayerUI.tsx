import React, {
  useRef,
  useState,
  RefObject,
  useEffect,
  useCallback,
} from "react";
import { showSelectedShapeActions } from "../element";
import { calculateScrollCenter, getSelectedElements } from "../scene";
import { exportCanvas } from "../data";

import { AppState, LibraryItems, LibraryItem } from "../types";
import { NonDeletedExcalidrawElement } from "../element/types";

import { ActionManager } from "../actions/manager";
import { Island } from "./Island";
import Stack from "./Stack";
import { FixedSideContainer } from "./FixedSideContainer";
import { UserList } from "./UserList";
import { LockIcon } from "./LockIcon";
import { ExportDialog, ExportCB } from "./ExportDialog";
import { LanguageList } from "./LanguageList";
import { t, languages, setLanguage } from "../i18n";
import { HintViewer } from "./HintViewer";
import useIsMobile from "../is-mobile";

import { ExportType } from "../scene/types";
import { MobileMenu } from "./MobileMenu";
import { ZoomActions, SelectedShapeActions, ShapesSwitcher } from "./Actions";
import { Section } from "./Section";
import { RoomDialog } from "./RoomDialog";
import { ErrorDialog } from "./ErrorDialog";
import { ShortcutsDialog } from "./ShortcutsDialog";
import { LoadingMessage } from "./LoadingMessage";
import { CLASSES } from "../constants";
import { shield, exportFile, load } from "./icons";
import { GitHubCorner } from "./GitHubCorner";
import { Tooltip } from "./Tooltip";

import "./LayerUI.scss";
import { LibraryUnit } from "./LibraryUnit";
import { loadLibrary, saveLibrary } from "../data/localStorage";
import { ToolButton } from "./ToolButton";
import { saveLibraryAsJSON, importLibraryFromJSON } from "../data/json";
import { muteFSAbortError } from "../utils";

interface LayerUIProps {
  actionManager: ActionManager;
  appState: AppState;
  canvas: HTMLCanvasElement | null;
  setAppState: any;
  elements: readonly NonDeletedExcalidrawElement[];
  onRoomCreate: () => void;
  onUsernameChange: (username: string) => void;
  onRoomDestroy: () => void;
  onLockToggle: () => void;
  onInsertShape: (elements: LibraryItem) => void;
  zenModeEnabled: boolean;
  toggleZenMode: () => void;
  lng: string;
}

function useOnClickOutside(
  ref: RefObject<HTMLElement>,
  cb: (event: MouseEvent) => void,
) {
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
}

const LibraryMenuItems = ({
  library,
  onRemoveFromLibrary,
  onAddToLibrary,
  onInsertShape,
  pendingElements,
  setAppState,
}: {
  library: LibraryItems;
  pendingElements: LibraryItem;
  onClickOutside: (event: MouseEvent) => void;
  onRemoveFromLibrary: (index: number) => void;
  onInsertShape: (elements: LibraryItem) => void;
  onAddToLibrary: (elements: LibraryItem) => void;
  setAppState: any;
}) => {
  const isMobile = useIsMobile();
  const numCells = library.length + (pendingElements.length > 0 ? 1 : 0);
  const CELLS_PER_ROW = isMobile ? 4 : 6;
  const numRows = Math.max(1, Math.ceil(numCells / CELLS_PER_ROW));
  const rows = [];
  let addedPendingElements = false;

  rows.push(
    <Stack.Row align="center" gap={1} key={"actions"}>
      <ToolButton
        key="import"
        type="button"
        title={t("buttons.load")}
        aria-label={t("buttons.load")}
        icon={load}
        onClick={() => {
          importLibraryFromJSON()
            .then(() => {
              // Maybe we should close and open the menu so that the items get updated.
              // But for now we just close the menu.
              setAppState({ isLibraryOpen: false });
            })
            .catch(muteFSAbortError)
            .catch((error) => {
              setAppState({ errorMessage: error.message });
            });
        }}
      />
      <ToolButton
        key="export"
        type="button"
        title={t("buttons.export")}
        aria-label={t("buttons.export")}
        icon={exportFile}
        onClick={() => {
          saveLibraryAsJSON()
            .catch(muteFSAbortError)
            .catch((error) => {
              setAppState({ errorMessage: error.message });
            });
        }}
      />
    </Stack.Row>,
  );

  for (let row = 0; row < numRows; row++) {
    const i = CELLS_PER_ROW * row;
    const children = [];
    for (let j = 0; j < CELLS_PER_ROW; j++) {
      const shouldAddPendingElements: boolean =
        pendingElements.length > 0 &&
        !addedPendingElements &&
        i + j >= library.length;
      addedPendingElements = addedPendingElements || shouldAddPendingElements;

      children.push(
        <Stack.Col key={j}>
          <LibraryUnit
            elements={library[i + j]}
            pendingElements={
              shouldAddPendingElements ? pendingElements : undefined
            }
            onRemoveFromLibrary={onRemoveFromLibrary.bind(null, i + j)}
            onClick={
              shouldAddPendingElements
                ? onAddToLibrary.bind(null, pendingElements)
                : onInsertShape.bind(null, library[i + j])
            }
          />
        </Stack.Col>,
      );
    }
    rows.push(
      <Stack.Row align="center" gap={1} key={row}>
        {children}
      </Stack.Row>,
    );
  }

  return (
    <Stack.Col align="center" gap={1} className="layer-ui__library-items">
      {rows}
    </Stack.Col>
  );
};

const LibraryMenu = ({
  onClickOutside,
  onInsertShape,
  pendingElements,
  onAddToLibrary,
  setAppState,
}: {
  pendingElements: LibraryItem;
  onClickOutside: (event: MouseEvent) => void;
  onInsertShape: (elements: LibraryItem) => void;
  onAddToLibrary: () => void;
  setAppState: any;
}) => {
  const ref = useRef<HTMLDivElement | null>(null);
  useOnClickOutside(ref, onClickOutside);

  const [libraryItems, setLibraryItems] = useState<LibraryItems>([]);

  const [loadingState, setIsLoading] = useState<
    "preloading" | "loading" | "ready"
  >("preloading");

  const loadingTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    Promise.race([
      new Promise((resolve) => {
        loadingTimerRef.current = setTimeout(() => {
          resolve("loading");
        }, 100);
      }),
      loadLibrary().then((items) => {
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
  }, []);

  const removeFromLibrary = useCallback(async (indexToRemove) => {
    const items = await loadLibrary();
    const nextItems = items.filter((_, index) => index !== indexToRemove);
    saveLibrary(nextItems);
    setLibraryItems(nextItems);
  }, []);

  const addToLibrary = useCallback(
    async (elements: LibraryItem) => {
      const items = await loadLibrary();
      const nextItems = [...items, elements];
      onAddToLibrary();
      saveLibrary(nextItems);
      setLibraryItems(nextItems);
    },
    [onAddToLibrary],
  );

  return loadingState === "preloading" ? null : (
    <Island padding={1} ref={ref} className="layer-ui__library">
      {loadingState === "loading" ? (
        <div className="layer-ui__library-message">
          {t("labels.libraryLoadingMessage")}
        </div>
      ) : (
        <LibraryMenuItems
          library={libraryItems}
          onClickOutside={onClickOutside}
          onRemoveFromLibrary={removeFromLibrary}
          onAddToLibrary={addToLibrary}
          onInsertShape={onInsertShape}
          pendingElements={pendingElements}
          setAppState={setAppState}
        />
      )}
    </Island>
  );
};

const LayerUI = ({
  actionManager,
  appState,
  setAppState,
  canvas,
  elements,
  onRoomCreate,
  onUsernameChange,
  onRoomDestroy,
  onLockToggle,
  onInsertShape,
  zenModeEnabled,
  toggleZenMode,
}: LayerUIProps) => {
  const isMobile = useIsMobile();

  // TODO: Extend tooltip component and use here.
  const renderEncryptedIcon = () => (
    <a
      className={`encrypted-icon tooltip zen-mode-visibility ${
        zenModeEnabled ? "zen-mode-visibility--hidden" : ""
      }`}
      href="https://blog.excalidraw.com/end-to-end-encryption/"
      target="_blank"
      rel="noopener noreferrer"
    >
      <span className="tooltip-text" dir="auto">
        {t("encrypted.tooltip")}
      </span>
      {shield}
    </a>
  );

  const renderExportDialog = () => {
    const createExporter = (type: ExportType): ExportCB => (
      exportedElements,
      scale,
    ) => {
      if (canvas) {
        exportCanvas(type, exportedElements, appState, canvas, {
          exportBackground: appState.exportBackground,
          name: appState.name,
          viewBackgroundColor: appState.viewBackgroundColor,
          scale,
          shouldAddWatermark: appState.shouldAddWatermark,
        });
      }
    };
    return (
      <ExportDialog
        elements={elements}
        appState={appState}
        actionManager={actionManager}
        onExportToPng={createExporter("png")}
        onExportToSvg={createExporter("svg")}
        onExportToClipboard={createExporter("clipboard")}
        onExportToBackend={(exportedElements) => {
          if (canvas) {
            exportCanvas(
              "backend",
              exportedElements,
              {
                ...appState,
                selectedElementIds: {},
              },
              canvas,
              appState,
            );
          }
        }}
      />
    );
  };

  const renderCanvasActions = () => (
    <Section
      heading="canvasActions"
      className={`zen-mode-transition ${zenModeEnabled && "transition-left"}`}
    >
      {/* the zIndex ensures this menu has higher stacking order,
         see https://github.com/excalidraw/excalidraw/pull/1445 */}
      <Island padding={4} style={{ zIndex: 1 }}>
        <Stack.Col gap={4}>
          <Stack.Row gap={1} justifyContent="space-between">
            {actionManager.renderAction("loadScene")}
            {actionManager.renderAction("saveScene")}
            {actionManager.renderAction("saveAsScene")}
            {renderExportDialog()}
            {actionManager.renderAction("clearCanvas")}
            <RoomDialog
              isCollaborating={appState.isCollaborating}
              collaboratorCount={appState.collaborators.size}
              username={appState.username}
              onUsernameChange={onUsernameChange}
              onRoomCreate={onRoomCreate}
              onRoomDestroy={onRoomDestroy}
            />
          </Stack.Row>
          {actionManager.renderAction("changeViewBackgroundColor")}
        </Stack.Col>
      </Island>
    </Section>
  );

  const renderSelectedShapeActions = () => (
    <Section
      heading="selectedShapeActions"
      className={`zen-mode-transition ${zenModeEnabled && "transition-left"}`}
    >
      <Island className={CLASSES.SHAPE_ACTIONS_MENU} padding={4}>
        <SelectedShapeActions
          appState={appState}
          elements={elements}
          renderAction={actionManager.renderAction}
          elementType={appState.elementType}
        />
      </Island>
    </Section>
  );

  const closeLibrary = useCallback(
    (event) => {
      setAppState({ isLibraryOpen: false });
    },
    [setAppState],
  );

  const deselectItems = useCallback(() => {
    setAppState({
      selectedElementIds: {},
      selectedGroupIds: {},
    });
  }, [setAppState]);

  const libraryMenu = appState.isLibraryOpen ? (
    <LibraryMenu
      pendingElements={getSelectedElements(elements, appState)}
      onClickOutside={closeLibrary}
      onInsertShape={onInsertShape}
      onAddToLibrary={deselectItems}
      setAppState={setAppState}
    />
  ) : null;

  const renderFixedSideContainer = () => {
    const shouldRenderSelectedShapeActions = showSelectedShapeActions(
      appState,
      elements,
    );

    return (
      <FixedSideContainer side="top">
        <HintViewer appState={appState} elements={elements} />
        <div className="App-menu App-menu_top">
          <Stack.Col
            gap={4}
            className={zenModeEnabled && "disable-pointerEvents"}
          >
            {renderCanvasActions()}
            {shouldRenderSelectedShapeActions && renderSelectedShapeActions()}
          </Stack.Col>
          <Section heading="shapes">
            {(heading) => (
              <Stack.Col gap={4} align="start">
                <Stack.Row gap={1}>
                  <Island padding={1} className={zenModeEnabled && "zen-mode"}>
                    {heading}
                    <Stack.Row gap={1}>
                      <ShapesSwitcher
                        elementType={appState.elementType}
                        setAppState={setAppState}
                        isLibraryOpen={appState.isLibraryOpen}
                      />
                    </Stack.Row>
                  </Island>
                  <LockIcon
                    zenModeEnabled={zenModeEnabled}
                    checked={appState.elementLocked}
                    onChange={onLockToggle}
                    title={t("toolBar.lock")}
                  />
                </Stack.Row>
                {libraryMenu}
              </Stack.Col>
            )}
          </Section>
          <UserList
            className={`zen-mode-transition ${
              zenModeEnabled && "transition-right"
            }`}
          >
            {Array.from(appState.collaborators)
              // Collaborator is either not initialized or is actually the current user.
              .filter(([_, client]) => Object.keys(client).length !== 0)
              .map(([clientId, client]) => (
                <Tooltip
                  label={client.username || "Unknown user"}
                  key={clientId}
                >
                  {actionManager.renderAction("goToCollaborator", clientId)}
                </Tooltip>
              ))}
          </UserList>
        </div>
      </FixedSideContainer>
    );
  };

  const renderBottomAppMenu = () => {
    return (
      <div
        className={`App-menu App-menu_bottom zen-mode-transition ${
          zenModeEnabled && "App-menu_bottom--transition-left"
        }`}
      >
        <Stack.Col gap={2}>
          <Section heading="canvasActions">
            <Island padding={1}>
              <ZoomActions
                renderAction={actionManager.renderAction}
                zoom={appState.zoom}
              />
            </Island>
            {renderEncryptedIcon()}
          </Section>
        </Stack.Col>
      </div>
    );
  };

  const renderFooter = () => (
    <footer role="contentinfo" className="layer-ui__wrapper__footer">
      <div
        className={`zen-mode-transition ${
          zenModeEnabled && "transition-right disable-pointerEvents"
        }`}
      >
        <LanguageList
          onChange={async (lng) => {
            await setLanguage(lng);
            setAppState({});
          }}
          languages={languages}
          floating
        />
        {actionManager.renderAction("toggleShortcuts")}
      </div>
      <button
        className={`disable-zen-mode ${
          zenModeEnabled && "disable-zen-mode--visible"
        }`}
        onClick={toggleZenMode}
      >
        {t("buttons.exitZenMode")}
      </button>
      {appState.scrolledOutside && (
        <button
          className="scroll-back-to-content"
          onClick={() => {
            setAppState({
              ...calculateScrollCenter(elements, appState, canvas),
            });
          }}
        >
          {t("buttons.scrollBackToContent")}
        </button>
      )}
    </footer>
  );

  return isMobile ? (
    <MobileMenu
      appState={appState}
      elements={elements}
      actionManager={actionManager}
      libraryMenu={libraryMenu}
      exportButton={renderExportDialog()}
      setAppState={setAppState}
      onUsernameChange={onUsernameChange}
      onRoomCreate={onRoomCreate}
      onRoomDestroy={onRoomDestroy}
      onLockToggle={onLockToggle}
      canvas={canvas}
    />
  ) : (
    <div className="layer-ui__wrapper">
      {appState.isLoading && <LoadingMessage />}
      {appState.errorMessage && (
        <ErrorDialog
          message={appState.errorMessage}
          onClose={() => setAppState({ errorMessage: null })}
        />
      )}
      {appState.showShortcutsDialog && (
        <ShortcutsDialog
          onClose={() => setAppState({ showShortcutsDialog: null })}
        />
      )}
      {renderFixedSideContainer()}
      {renderBottomAppMenu()}
      {
        <aside
          className={`layer-ui__wrapper__github-corner zen-mode-transition ${
            zenModeEnabled && "transition-right"
          }`}
        >
          <GitHubCorner />
        </aside>
      }
      {renderFooter()}
    </div>
  );
};

const areEqual = (prev: LayerUIProps, next: LayerUIProps) => {
  const getNecessaryObj = (appState: AppState): Partial<AppState> => {
    const {
      cursorX,
      cursorY,
      suggestedBindings,
      startBoundElement: boundElement,
      ...ret
    } = appState;
    return ret;
  };
  const prevAppState = getNecessaryObj(prev.appState);
  const nextAppState = getNecessaryObj(next.appState);

  const keys = Object.keys(prevAppState) as (keyof Partial<AppState>)[];

  return (
    prev.lng === next.lng &&
    prev.elements === next.elements &&
    keys.every((key) => prevAppState[key] === nextAppState[key])
  );
};

export default React.memo(LayerUI, areEqual);

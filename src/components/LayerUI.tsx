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
import CollabButton from "./CollabButton";
import { ErrorDialog } from "./ErrorDialog";
import { ShortcutsDialog } from "./ShortcutsDialog";
import { LoadingMessage } from "./LoadingMessage";
import { CLASSES } from "../constants";
import { shield, exportFile, load } from "./icons";
import { GitHubCorner } from "./GitHubCorner";
import { Tooltip } from "./Tooltip";

import "./LayerUI.scss";
import { LibraryUnit } from "./LibraryUnit";
import { ToolButton } from "./ToolButton";
import { saveLibraryAsJSON, importLibraryFromJSON } from "../data/json";
import { muteFSAbortError } from "../utils";
import { BackgroundPickerAndDarkModeToggle } from "./BackgroundPickerAndDarkModeToggle";
import clsx from "clsx";
import { Library } from "../data/library";
import {
  EVENT_ACTION,
  EVENT_EXIT,
  EVENT_LIBRARY,
  trackEvent,
} from "../analytics";
import { PasteChartDialog } from "./PasteChartDialog";

interface LayerUIProps {
  actionManager: ActionManager;
  appState: AppState;
  canvas: HTMLCanvasElement | null;
  setAppState: React.Component<any, AppState>["setState"];
  elements: readonly NonDeletedExcalidrawElement[];
  onCollabButtonClick?: () => void;
  onLockToggle: () => void;
  onInsertShape: (elements: LibraryItem) => void;
  zenModeEnabled: boolean;
  toggleZenMode: () => void;
  lng: string;
  isCollaborating: boolean;
  onExportToBackend?: (
    exportedElements: readonly NonDeletedExcalidrawElement[],
    appState: AppState,
    canvas: HTMLCanvasElement | null,
  ) => void;
}

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
  library,
  onRemoveFromLibrary,
  onAddToLibrary,
  onInsertShape,
  pendingElements,
  setAppState,
}: {
  library: LibraryItems;
  pendingElements: LibraryItem;
  onRemoveFromLibrary: (index: number) => void;
  onInsertShape: (elements: LibraryItem) => void;
  onAddToLibrary: (elements: LibraryItem) => void;
  setAppState: React.Component<any, AppState>["setState"];
}) => {
  const isMobile = useIsMobile();
  const numCells = library.length + (pendingElements.length > 0 ? 1 : 0);
  const CELLS_PER_ROW = isMobile ? 4 : 6;
  const numRows = Math.max(1, Math.ceil(numCells / CELLS_PER_ROW));
  const rows = [];
  let addedPendingElements = false;

  rows.push(
    <>
      <a
        className="browse-libraries"
        href="https://libraries.excalidraw.com"
        target="_excalidraw_libraries"
        onClick={() => {
          trackEvent(EVENT_EXIT, "libraries");
        }}
      >
        {t("labels.libraries")}
      </a>

      <Stack.Row
        align="center"
        gap={1}
        key={"actions"}
        style={{ padding: "2px" }}
      >
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
      </Stack.Row>
    </>,
  );

  for (let row = 0; row < numRows; row++) {
    const y = CELLS_PER_ROW * row;
    const children = [];
    for (let x = 0; x < CELLS_PER_ROW; x++) {
      const shouldAddPendingElements: boolean =
        pendingElements.length > 0 &&
        !addedPendingElements &&
        y + x >= library.length;
      addedPendingElements = addedPendingElements || shouldAddPendingElements;

      children.push(
        <Stack.Col key={x}>
          <LibraryUnit
            elements={library[y + x]}
            pendingElements={
              shouldAddPendingElements ? pendingElements : undefined
            }
            onRemoveFromLibrary={onRemoveFromLibrary.bind(null, y + x)}
            onClick={
              shouldAddPendingElements
                ? onAddToLibrary.bind(null, pendingElements)
                : onInsertShape.bind(null, library[y + x])
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
    <Stack.Col align="start" gap={1} className="layer-ui__library-items">
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
  setAppState: React.Component<any, AppState>["setState"];
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

  const loadingTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    Promise.race([
      new Promise((resolve) => {
        loadingTimerRef.current = setTimeout(() => {
          resolve("loading");
        }, 100);
      }),
      Library.loadLibrary().then((items) => {
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
    const items = await Library.loadLibrary();
    const nextItems = items.filter((_, index) => index !== indexToRemove);
    Library.saveLibrary(nextItems);
    trackEvent(EVENT_LIBRARY, "remove");
    setLibraryItems(nextItems);
  }, []);

  const addToLibrary = useCallback(
    async (elements: LibraryItem) => {
      const items = await Library.loadLibrary();
      const nextItems = [...items, elements];
      onAddToLibrary();
      trackEvent(EVENT_LIBRARY, "add");
      Library.saveLibrary(nextItems);
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
  onCollabButtonClick,
  onLockToggle,
  onInsertShape,
  zenModeEnabled,
  toggleZenMode,
  isCollaborating,
  onExportToBackend,
}: LayerUIProps) => {
  const isMobile = useIsMobile();

  const renderEncryptedIcon = () => (
    <a
      className={clsx("encrypted-icon tooltip zen-mode-visibility", {
        "zen-mode-visibility--hidden": zenModeEnabled,
      })}
      href="https://blog.excalidraw.com/end-to-end-encryption/"
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => {
        trackEvent(EVENT_EXIT, "e2ee shield");
      }}
    >
      <Tooltip label={t("encrypted.tooltip")} position="above" long={true}>
        {shield}
      </Tooltip>
    </a>
  );

  const renderExportDialog = () => {
    const createExporter = (type: ExportType): ExportCB => async (
      exportedElements,
      scale,
    ) => {
      if (canvas) {
        await exportCanvas(type, exportedElements, appState, canvas, {
          exportBackground: appState.exportBackground,
          name: appState.name,
          viewBackgroundColor: appState.viewBackgroundColor,
          scale,
          shouldAddWatermark: appState.shouldAddWatermark,
        })
          .catch(muteFSAbortError)
          .catch((error) => {
            console.error(error);
            setAppState({ errorMessage: error.message });
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
        onExportToBackend={
          onExportToBackend
            ? (elements) => {
                onExportToBackend &&
                  onExportToBackend(elements, appState, canvas);
              }
            : undefined
        }
      />
    );
  };

  const renderCanvasActions = () => (
    <Section
      heading="canvasActions"
      className={clsx("zen-mode-transition", {
        "transition-left": zenModeEnabled,
      })}
    >
      {/* the zIndex ensures this menu has higher stacking order,
         see https://github.com/excalidraw/excalidraw/pull/1445 */}
      <Island padding={2} style={{ zIndex: 1 }}>
        <Stack.Col gap={4}>
          <Stack.Row gap={1} justifyContent="space-between">
            {actionManager.renderAction("loadScene")}
            {actionManager.renderAction("saveScene")}
            {actionManager.renderAction("saveAsScene")}
            {renderExportDialog()}
            {actionManager.renderAction("clearCanvas")}
            {onCollabButtonClick && (
              <CollabButton
                isCollaborating={isCollaborating}
                collaboratorCount={appState.collaborators.size}
                onClick={onCollabButtonClick}
              />
            )}
          </Stack.Row>
          <BackgroundPickerAndDarkModeToggle
            actionManager={actionManager}
            appState={appState}
            setAppState={setAppState}
          />
        </Stack.Col>
      </Island>
    </Section>
  );

  const renderSelectedShapeActions = () => (
    <Section
      heading="selectedShapeActions"
      className={clsx("zen-mode-transition", {
        "transition-left": zenModeEnabled,
      })}
    >
      <Island className={CLASSES.SHAPE_ACTIONS_MENU} padding={2}>
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
        <div className="App-menu App-menu_top">
          <Stack.Col
            gap={4}
            className={clsx({ "disable-pointerEvents": zenModeEnabled })}
          >
            {renderCanvasActions()}
            {shouldRenderSelectedShapeActions && renderSelectedShapeActions()}
          </Stack.Col>
          <Section heading="shapes">
            {(heading) => (
              <Stack.Col gap={4} align="start">
                <Stack.Row gap={1}>
                  <Island
                    padding={1}
                    className={clsx({ "zen-mode": zenModeEnabled })}
                  >
                    <HintViewer appState={appState} elements={elements} />
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
            className={clsx("zen-mode-transition", {
              "transition-right": zenModeEnabled,
            })}
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
        className={clsx("App-menu App-menu_bottom zen-mode-transition", {
          "App-menu_bottom--transition-left": zenModeEnabled,
        })}
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
        className={clsx("zen-mode-transition", {
          "transition-right disable-pointerEvents": zenModeEnabled,
        })}
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
        className={clsx("disable-zen-mode", {
          "disable-zen-mode--visible": zenModeEnabled,
        })}
        onClick={toggleZenMode}
      >
        {t("buttons.exitZenMode")}
      </button>
      {appState.scrolledOutside && (
        <button
          className="scroll-back-to-content"
          onClick={() => {
            trackEvent(EVENT_ACTION, "scroll to content");
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
      onCollabButtonClick={onCollabButtonClick}
      onLockToggle={onLockToggle}
      canvas={canvas}
      isCollaborating={isCollaborating}
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
          onClose={() => setAppState({ showShortcutsDialog: false })}
        />
      )}
      {appState.charts.shown && (
        <PasteChartDialog
          setAppState={setAppState}
          appState={appState}
          onClose={() =>
            setAppState({ charts: { ...appState.charts, shown: false } })
          }
        />
      )}
      {renderFixedSideContainer()}
      {renderBottomAppMenu()}
      {
        <aside
          className={clsx(
            "layer-ui__wrapper__github-corner zen-mode-transition",
            {
              "transition-right": zenModeEnabled,
            },
          )}
        >
          <GitHubCorner appearance={appState.appearance} />
        </aside>
      }
      {renderFooter()}
    </div>
  );
};

const areEqual = (prev: LayerUIProps, next: LayerUIProps) => {
  const getNecessaryObj = (appState: AppState): Partial<AppState> => {
    const {
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

import clsx from "clsx";
import React, {
  RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { ActionManager } from "../actions/manager";
import { CLASSES } from "../constants";
import { exportCanvas } from "../data";
import { importLibraryFromJSON, saveLibraryAsJSON } from "../data/json";
import { isTextElement, showSelectedShapeActions } from "../element";
import { NonDeletedExcalidrawElement } from "../element/types";
import { Language, t } from "../i18n";
import { useIsMobile } from "../components/App";
import { calculateScrollCenter, getSelectedElements } from "../scene";
import { ExportType } from "../scene/types";
import {
  AppProps,
  AppState,
  ExcalidrawProps,
  LibraryItem,
  LibraryItems,
} from "../types";
import { muteFSAbortError } from "../utils";
import { SelectedShapeActions, ShapesSwitcher, ZoomActions } from "./Actions";
import { BackgroundPickerAndDarkModeToggle } from "./BackgroundPickerAndDarkModeToggle";
import CollabButton from "./CollabButton";
import { ErrorDialog } from "./ErrorDialog";
import { ExportCB, ImageExportDialog } from "./ImageExportDialog";
import { FixedSideContainer } from "./FixedSideContainer";
import { HintViewer } from "./HintViewer";
import { exportFile, load, trash } from "./icons";
import { Island } from "./Island";
import "./LayerUI.scss";
import { LibraryUnit } from "./LibraryUnit";
import { LoadingMessage } from "./LoadingMessage";
import { LockButton } from "./LockButton";
import { MobileMenu } from "./MobileMenu";
import { PasteChartDialog } from "./PasteChartDialog";
import { Section } from "./Section";
import { HelpDialog } from "./HelpDialog";
import Stack from "./Stack";
import { ToolButton } from "./ToolButton";
import { Tooltip } from "./Tooltip";
import { UserList } from "./UserList";
import Library from "../data/library";
import { JSONExportDialog } from "./JSONExportDialog";
import { LibraryButton } from "./LibraryButton";
import { isImageFileHandle } from "../data/blob";

interface LayerUIProps {
  actionManager: ActionManager;
  appState: AppState;
  canvas: HTMLCanvasElement | null;
  setAppState: React.Component<any, AppState>["setState"];
  elements: readonly NonDeletedExcalidrawElement[];
  onCollabButtonClick?: () => void;
  onLockToggle: () => void;
  onInsertElements: (elements: readonly NonDeletedExcalidrawElement[]) => void;
  zenModeEnabled: boolean;
  showExitZenModeBtn: boolean;
  showThemeBtn: boolean;
  toggleZenMode: () => void;
  langCode: Language["code"];
  isCollaborating: boolean;
  renderTopRightUI?: (isMobile: boolean, appState: AppState) => JSX.Element;
  renderCustomFooter?: (isMobile: boolean, appState: AppState) => JSX.Element;
  viewModeEnabled: boolean;
  libraryReturnUrl: ExcalidrawProps["libraryReturnUrl"];
  UIOptions: AppProps["UIOptions"];
  focusContainer: () => void;
  library: Library;
  id: string;
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
  id,
}: {
  libraryItems: LibraryItems;
  pendingElements: LibraryItem;
  onRemoveFromLibrary: (index: number) => void;
  onInsertShape: (elements: LibraryItem) => void;
  onAddToLibrary: (elements: LibraryItem) => void;
  theme: AppState["theme"];
  setAppState: React.Component<any, AppState>["setState"];
  setLibraryItems: (library: LibraryItems) => void;
  libraryReturnUrl: ExcalidrawProps["libraryReturnUrl"];
  focusContainer: () => void;
  library: Library;
  id: string;
}) => {
  const isMobile = useIsMobile();
  const numCells = libraryItems.length + (pendingElements.length > 0 ? 1 : 0);
  const CELLS_PER_ROW = isMobile ? 4 : 6;
  const numRows = Math.max(1, Math.ceil(numCells / CELLS_PER_ROW));
  const rows = [];
  let addedPendingElements = false;

  const referrer =
    libraryReturnUrl || window.location.origin + window.location.pathname;

  rows.push(
    <div className="layer-ui__library-header" key="library-header">
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
      {!!libraryItems.length && (
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
          />
        </>
      )}
      <a
        href={`https://libraries.excalidraw.com?target=${
          window.name || "_blank"
        }&referrer=${referrer}&useHash=true&token=${id}&theme=${theme}`}
        target="_excalidraw_libraries"
      >
        {t("labels.libraries")}
      </a>
    </div>,
  );

  for (let row = 0; row < numRows; row++) {
    const y = CELLS_PER_ROW * row;
    const children = [];
    for (let x = 0; x < CELLS_PER_ROW; x++) {
      const shouldAddPendingElements: boolean =
        pendingElements.length > 0 &&
        !addedPendingElements &&
        y + x >= libraryItems.length;
      addedPendingElements = addedPendingElements || shouldAddPendingElements;

      children.push(
        <Stack.Col key={x}>
          <LibraryUnit
            elements={libraryItems[y + x]}
            pendingElements={
              shouldAddPendingElements ? pendingElements : undefined
            }
            onRemoveFromLibrary={onRemoveFromLibrary.bind(null, y + x)}
            onClick={
              shouldAddPendingElements
                ? onAddToLibrary.bind(null, pendingElements)
                : onInsertShape.bind(null, libraryItems[y + x])
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
  theme,
  setAppState,
  libraryReturnUrl,
  focusContainer,
  library,
  id,
}: {
  pendingElements: LibraryItem;
  onClickOutside: (event: MouseEvent) => void;
  onInsertShape: (elements: LibraryItem) => void;
  onAddToLibrary: () => void;
  theme: AppState["theme"];
  setAppState: React.Component<any, AppState>["setState"];
  libraryReturnUrl: ExcalidrawProps["libraryReturnUrl"];
  focusContainer: () => void;
  library: Library;
  id: string;
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

  const removeFromLibrary = useCallback(
    async (indexToRemove) => {
      const items = await library.loadLibrary();
      const nextItems = items.filter((_, index) => index !== indexToRemove);
      library.saveLibrary(nextItems).catch((error) => {
        setLibraryItems(items);
        setAppState({ errorMessage: t("alerts.errorRemovingFromLibrary") });
      });
      setLibraryItems(nextItems);
    },
    [library, setAppState],
  );

  const addToLibrary = useCallback(
    async (elements: LibraryItem) => {
      const items = await library.loadLibrary();
      const nextItems = [...items, elements];
      onAddToLibrary();
      library.saveLibrary(nextItems).catch((error) => {
        setLibraryItems(items);
        setAppState({ errorMessage: t("alerts.errorAddingToLibrary") });
      });
      setLibraryItems(nextItems);
    },
    [onAddToLibrary, library, setAppState],
  );

  return loadingState === "preloading" ? null : (
    <Island padding={1} ref={ref} className="layer-ui__library">
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
          id={id}
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
  onInsertElements,
  zenModeEnabled,
  showExitZenModeBtn,
  showThemeBtn,
  toggleZenMode,
  isCollaborating,
  renderTopRightUI,
  renderCustomFooter,
  viewModeEnabled,
  libraryReturnUrl,
  UIOptions,
  focusContainer,
  library,
  id,
}: LayerUIProps) => {
  const isMobile = useIsMobile();

  const renderJSONExportDialog = () => {
    if (!UIOptions.canvasActions.export) {
      return null;
    }

    return (
      <JSONExportDialog
        elements={elements}
        appState={appState}
        actionManager={actionManager}
        exportOpts={UIOptions.canvasActions.export}
        canvas={canvas}
      />
    );
  };

  const renderImageExportDialog = () => {
    if (!UIOptions.canvasActions.saveAsImage) {
      return null;
    }

    const createExporter = (type: ExportType): ExportCB => async (
      exportedElements,
    ) => {
      const fileHandle = await exportCanvas(type, exportedElements, appState, {
        exportBackground: appState.exportBackground,
        name: appState.name,
        viewBackgroundColor: appState.viewBackgroundColor,
      })
        .catch(muteFSAbortError)
        .catch((error) => {
          console.error(error);
          setAppState({ errorMessage: error.message });
        });

      if (
        appState.exportEmbedScene &&
        fileHandle &&
        isImageFileHandle(fileHandle)
      ) {
        setAppState({ fileHandle });
      }
    };

    return (
      <ImageExportDialog
        elements={elements}
        appState={appState}
        actionManager={actionManager}
        onExportToPng={createExporter("png")}
        onExportToSvg={createExporter("svg")}
        onExportToClipboard={createExporter("clipboard")}
      />
    );
  };

  const Separator = () => {
    return <div style={{ width: ".625em" }} />;
  };

  const renderViewModeCanvasActions = () => {
    return (
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
              {renderJSONExportDialog()}
              {renderImageExportDialog()}
            </Stack.Row>
          </Stack.Col>
        </Island>
      </Section>
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
            {actionManager.renderAction("clearCanvas")}
            <Separator />
            {actionManager.renderAction("loadScene")}
            {renderJSONExportDialog()}
            {renderImageExportDialog()}
            <Separator />
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
            showThemeBtn={showThemeBtn}
          />
          {appState.fileHandle && (
            <>{actionManager.renderAction("saveToActiveFile")}</>
          )}
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
      <Island
        className={CLASSES.SHAPE_ACTIONS_MENU}
        padding={2}
        style={{
          // we want to make sure this doesn't overflow so substracting 200
          // which is approximately height of zoom footer and top left menu items with some buffer
          // if active file name is displayed, subtracting 248 to account for its height
          maxHeight: `${appState.height - (appState.fileHandle ? 248 : 200)}px`,
        }}
      >
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
      onInsertShape={onInsertElements}
      onAddToLibrary={deselectItems}
      setAppState={setAppState}
      libraryReturnUrl={libraryReturnUrl}
      focusContainer={focusContainer}
      library={library}
      theme={appState.theme}
      id={id}
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
            {viewModeEnabled
              ? renderViewModeCanvasActions()
              : renderCanvasActions()}
            {shouldRenderSelectedShapeActions && renderSelectedShapeActions()}
          </Stack.Col>
          {!viewModeEnabled && (
            <Section heading="shapes">
              {(heading) => (
                <Stack.Col gap={4} align="start">
                  <Stack.Row gap={1}>
                    <LockButton
                      zenModeEnabled={zenModeEnabled}
                      checked={appState.elementLocked}
                      onChange={onLockToggle}
                      title={t("toolBar.lock")}
                    />
                    <Island
                      padding={1}
                      className={clsx({ "zen-mode": zenModeEnabled })}
                    >
                      <HintViewer appState={appState} elements={elements} />
                      {heading}
                      <Stack.Row gap={1}>
                        <ShapesSwitcher
                          canvas={canvas}
                          elementType={appState.elementType}
                          setAppState={setAppState}
                        />
                      </Stack.Row>
                    </Island>
                    <LibraryButton
                      appState={appState}
                      setAppState={setAppState}
                    />
                  </Stack.Row>
                  {libraryMenu}
                </Stack.Col>
              )}
            </Section>
          )}
          <div
            className={clsx(
              "layer-ui__wrapper__top-right zen-mode-transition",
              {
                "transition-right": zenModeEnabled,
              },
            )}
          >
            <UserList>
              {appState.collaborators.size > 0 &&
                Array.from(appState.collaborators)
                  // Collaborator is either not initialized or is actually the current user.
                  .filter(([_, client]) => Object.keys(client).length !== 0)
                  .map(([clientId, client]) => (
                    <Tooltip
                      label={client.username || "Unknown user"}
                      key={clientId}
                    >
                      {actionManager.renderAction("goToCollaborator", {
                        id: clientId,
                      })}
                    </Tooltip>
                  ))}
            </UserList>
            {renderTopRightUI?.(isMobile, appState)}
          </div>
        </div>
      </FixedSideContainer>
    );
  };

  const renderBottomAppMenu = () => {
    return (
      <footer
        role="contentinfo"
        className="layer-ui__wrapper__footer App-menu App-menu_bottom"
      >
        <div
          className={clsx(
            "layer-ui__wrapper__footer-left zen-mode-transition",
            {
              "layer-ui__wrapper__footer-left--transition-left": zenModeEnabled,
            },
          )}
        >
          <Stack.Col gap={2}>
            <Section heading="canvasActions">
              <Island padding={1}>
                <ZoomActions
                  renderAction={actionManager.renderAction}
                  zoom={appState.zoom}
                />
              </Island>
              {!viewModeEnabled && (
                <div
                  className={clsx("undo-redo-buttons zen-mode-transition", {
                    "layer-ui__wrapper__footer-left--transition-bottom": zenModeEnabled,
                  })}
                >
                  {actionManager.renderAction("undo", { size: "small" })}
                  {actionManager.renderAction("redo", { size: "small" })}
                </div>
              )}
            </Section>
          </Stack.Col>
        </div>
        <div
          className={clsx(
            "layer-ui__wrapper__footer-center zen-mode-transition",
            {
              "layer-ui__wrapper__footer-left--transition-bottom": zenModeEnabled,
            },
          )}
        >
          {renderCustomFooter?.(false, appState)}
        </div>
        <div
          className={clsx(
            "layer-ui__wrapper__footer-right zen-mode-transition",
            {
              "transition-right disable-pointerEvents": zenModeEnabled,
            },
          )}
        >
          {actionManager.renderAction("toggleShortcuts")}
        </div>
        <button
          className={clsx("disable-zen-mode", {
            "disable-zen-mode--visible": showExitZenModeBtn,
          })}
          onClick={toggleZenMode}
        >
          {t("buttons.exitZenMode")}
        </button>
      </footer>
    );
  };

  const dialogs = (
    <>
      {appState.isLoading && <LoadingMessage />}
      {appState.errorMessage && (
        <ErrorDialog
          message={appState.errorMessage}
          onClose={() => setAppState({ errorMessage: null })}
        />
      )}
      {appState.showHelpDialog && (
        <HelpDialog
          onClose={() => {
            setAppState({ showHelpDialog: false });
          }}
        />
      )}
      {appState.pasteDialog.shown && (
        <PasteChartDialog
          setAppState={setAppState}
          appState={appState}
          onInsertChart={onInsertElements}
          onClose={() =>
            setAppState({
              pasteDialog: { shown: false, data: null },
            })
          }
        />
      )}
    </>
  );

  return isMobile ? (
    <>
      {dialogs}
      <MobileMenu
        appState={appState}
        elements={elements}
        actionManager={actionManager}
        libraryMenu={libraryMenu}
        renderJSONExportDialog={renderJSONExportDialog}
        renderImageExportDialog={renderImageExportDialog}
        setAppState={setAppState}
        onCollabButtonClick={onCollabButtonClick}
        onLockToggle={onLockToggle}
        canvas={canvas}
        isCollaborating={isCollaborating}
        renderCustomFooter={renderCustomFooter}
        viewModeEnabled={viewModeEnabled}
        showThemeBtn={showThemeBtn}
      />
    </>
  ) : (
    <div
      className={clsx("layer-ui__wrapper", {
        "disable-pointerEvents":
          appState.draggingElement ||
          appState.resizingElement ||
          (appState.editingElement && !isTextElement(appState.editingElement)),
      })}
    >
      {dialogs}
      {renderFixedSideContainer()}
      {renderBottomAppMenu()}
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
    prev.renderCustomFooter === next.renderCustomFooter &&
    prev.langCode === next.langCode &&
    prev.elements === next.elements &&
    keys.every((key) => prevAppState[key] === nextAppState[key])
  );
};

export default React.memo(LayerUI, areEqual);

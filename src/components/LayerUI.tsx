import clsx from "clsx";
import React, { useCallback } from "react";
import { ActionManager } from "../actions/manager";
import { CLASSES, LIBRARY_SIDEBAR_WIDTH } from "../constants";
import { exportCanvas } from "../data";
import { isTextElement, showSelectedShapeActions } from "../element";
import { NonDeletedExcalidrawElement } from "../element/types";
import { Language, t } from "../i18n";
import { calculateScrollCenter, getSelectedElements } from "../scene";
import { ExportType } from "../scene/types";
import { AppProps, AppState, ExcalidrawProps, BinaryFiles } from "../types";
import { muteFSAbortError } from "../utils";
import { SelectedShapeActions, ShapesSwitcher, ZoomActions } from "./Actions";
import { BackgroundPickerAndDarkModeToggle } from "./BackgroundPickerAndDarkModeToggle";
import CollabButton from "./CollabButton";
import { ErrorDialog } from "./ErrorDialog";
import { ExportCB, ImageExportDialog } from "./ImageExportDialog";
import { FixedSideContainer } from "./FixedSideContainer";
import { HintViewer } from "./HintViewer";
import { Island } from "./Island";
import { LoadingMessage } from "./LoadingMessage";
import { LockButton } from "./LockButton";
import { MobileMenu } from "./MobileMenu";
import { PasteChartDialog } from "./PasteChartDialog";
import { Section } from "./Section";
import { HelpDialog } from "./HelpDialog";
import Stack from "./Stack";
import { UserList } from "./UserList";
import Library, { distributeLibraryItemsOnSquareGrid } from "../data/library";
import { JSONExportDialog } from "./JSONExportDialog";
import { LibraryButton } from "./LibraryButton";
import { isImageFileHandle } from "../data/blob";
import { LibraryMenu } from "./LibraryMenu";

import "./LayerUI.scss";
import "./Toolbar.scss";
import { PenModeButton } from "./PenModeButton";
import { trackEvent } from "../analytics";
import { useDevice } from "../components/App";
import { Stats } from "./Stats";
import { actionToggleStats } from "../actions/actionToggleStats";
import { actionToggleZenMode } from "../actions";

interface LayerUIProps {
  actionManager: ActionManager;
  appState: AppState;
  files: BinaryFiles;
  canvas: HTMLCanvasElement | null;
  setAppState: React.Component<any, AppState>["setState"];
  elements: readonly NonDeletedExcalidrawElement[];
  onCollabButtonClick?: () => void;
  onLockToggle: () => void;
  onPenModeToggle: () => void;
  onInsertElements: (elements: readonly NonDeletedExcalidrawElement[]) => void;
  showExitZenModeBtn: boolean;
  showThemeBtn: boolean;
  langCode: Language["code"];
  isCollaborating: boolean;
  renderTopRightUI?: ExcalidrawProps["renderTopRightUI"];
  renderCustomFooter?: ExcalidrawProps["renderFooter"];
  renderCustomStats?: ExcalidrawProps["renderCustomStats"];
  libraryReturnUrl: ExcalidrawProps["libraryReturnUrl"];
  UIOptions: AppProps["UIOptions"];
  focusContainer: () => void;
  library: Library;
  id: string;
  onImageAction: (data: { insertOnCanvasDirectly: boolean }) => void;
}
const LayerUI = ({
  actionManager,
  appState,
  files,
  setAppState,
  elements,
  canvas,
  onCollabButtonClick,
  onLockToggle,
  onPenModeToggle,
  onInsertElements,
  showExitZenModeBtn,
  showThemeBtn,
  isCollaborating,
  renderTopRightUI,
  renderCustomFooter,
  renderCustomStats,
  libraryReturnUrl,
  UIOptions,
  focusContainer,
  library,
  id,
  onImageAction,
}: LayerUIProps) => {
  const device = useDevice();

  const renderJSONExportDialog = () => {
    if (!UIOptions.canvasActions.export) {
      return null;
    }

    return (
      <JSONExportDialog
        elements={elements}
        appState={appState}
        files={files}
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

    const createExporter =
      (type: ExportType): ExportCB =>
      async (exportedElements) => {
        trackEvent("export", type, "ui");
        const fileHandle = await exportCanvas(
          type,
          exportedElements,
          appState,
          files,
          {
            exportBackground: appState.exportBackground,
            name: appState.name,
            viewBackgroundColor: appState.viewBackgroundColor,
          },
        )
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
        files={files}
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
          "transition-left": appState.zenModeEnabled,
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
        "transition-left": appState.zenModeEnabled,
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
            appState={appState}
            actionManager={actionManager}
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
        "transition-left": appState.zenModeEnabled,
      })}
    >
      <Island
        className={CLASSES.SHAPE_ACTIONS_MENU}
        padding={2}
        style={{
          // we want to make sure this doesn't overflow so subtracting 200
          // which is approximately height of zoom footer and top left menu items with some buffer
          // if active file name is displayed, subtracting 248 to account for its height
          maxHeight: `${appState.height - (appState.fileHandle ? 248 : 200)}px`,
        }}
      >
        <SelectedShapeActions renderAction={actionManager.renderAction} />
      </Island>
    </Section>
  );

  const closeLibrary = useCallback(() => {
    const isDialogOpen = !!document.querySelector(".Dialog");

    // Prevent closing if any dialog is open
    if (isDialogOpen) {
      return;
    }
    setAppState({ isLibraryOpen: false });
  }, [setAppState]);

  const deselectItems = useCallback(() => {
    setAppState({
      selectedElementIds: {},
      selectedGroupIds: {},
    });
  }, [setAppState]);

  const libraryMenu = appState.isLibraryOpen ? (
    <LibraryMenu
      pendingElements={getSelectedElements(elements, appState, true)}
      onClose={closeLibrary}
      onInsertLibraryItems={(libraryItems) => {
        onInsertElements(distributeLibraryItemsOnSquareGrid(libraryItems));
      }}
      onAddToLibrary={deselectItems}
      setAppState={setAppState}
      libraryReturnUrl={libraryReturnUrl}
      focusContainer={focusContainer}
      library={library}
      files={files}
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
            className={clsx({
              "disable-pointerEvents": appState.zenModeEnabled,
            })}
          >
            {appState.viewModeEnabled
              ? renderViewModeCanvasActions()
              : renderCanvasActions()}
            {shouldRenderSelectedShapeActions && renderSelectedShapeActions()}
          </Stack.Col>
          {!appState.viewModeEnabled && (
            <Section heading="shapes">
              {(heading: React.ReactNode) => (
                <Stack.Col gap={4} align="start">
                  <Stack.Row
                    gap={1}
                    className={clsx("App-toolbar-container", {
                      "zen-mode": appState.zenModeEnabled,
                    })}
                  >
                    <PenModeButton
                      zenModeEnabled={appState.zenModeEnabled}
                      checked={appState.penMode}
                      onChange={onPenModeToggle}
                      title={t("toolBar.penMode")}
                      penDetected={appState.penDetected}
                    />
                    <LockButton
                      zenModeEnabled={appState.zenModeEnabled}
                      checked={appState.activeTool.locked}
                      onChange={() => onLockToggle()}
                      title={t("toolBar.lock")}
                    />
                    <Island
                      padding={1}
                      className={clsx("App-toolbar", {
                        "zen-mode": appState.zenModeEnabled,
                      })}
                    >
                      <HintViewer
                        appState={appState}
                        elements={elements}
                        isMobile={device.isMobile}
                      />
                      {heading}
                      <Stack.Row gap={1}>
                        <ShapesSwitcher
                          appState={appState}
                          canvas={canvas}
                          activeTool={appState.activeTool}
                          setAppState={setAppState}
                          onImageAction={({ pointerType }) => {
                            onImageAction({
                              insertOnCanvasDirectly: pointerType !== "mouse",
                            });
                          }}
                        />
                      </Stack.Row>
                    </Island>
                    <LibraryButton
                      appState={appState}
                      setAppState={setAppState}
                    />
                  </Stack.Row>
                </Stack.Col>
              )}
            </Section>
          )}
          <div
            className={clsx(
              "layer-ui__wrapper__top-right zen-mode-transition",
              {
                "transition-right": appState.zenModeEnabled,
              },
            )}
          >
            <UserList
              collaborators={appState.collaborators}
              actionManager={actionManager}
            />
            {renderTopRightUI?.(device.isMobile, appState)}
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
              "layer-ui__wrapper__footer-left--transition-left":
                appState.zenModeEnabled,
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
              {!appState.viewModeEnabled && (
                <>
                  <div
                    className={clsx("undo-redo-buttons zen-mode-transition", {
                      "layer-ui__wrapper__footer-left--transition-bottom":
                        appState.zenModeEnabled,
                    })}
                  >
                    {actionManager.renderAction("undo", { size: "small" })}
                    {actionManager.renderAction("redo", { size: "small" })}
                  </div>

                  <div
                    className={clsx("eraser-buttons zen-mode-transition", {
                      "layer-ui__wrapper__footer-left--transition-left":
                        appState.zenModeEnabled,
                    })}
                  >
                    {actionManager.renderAction("eraser", { size: "small" })}
                  </div>
                </>
              )}
              {!appState.viewModeEnabled &&
                appState.multiElement &&
                device.isTouchScreen && (
                  <div
                    className={clsx("finalize-button zen-mode-transition", {
                      "layer-ui__wrapper__footer-left--transition-left":
                        appState.zenModeEnabled,
                    })}
                  >
                    {actionManager.renderAction("finalize", { size: "small" })}
                  </div>
                )}
            </Section>
          </Stack.Col>
        </div>
        <div
          className={clsx(
            "layer-ui__wrapper__footer-center zen-mode-transition",
            {
              "layer-ui__wrapper__footer-left--transition-bottom":
                appState.zenModeEnabled,
            },
          )}
        >
          {renderCustomFooter?.(false, appState)}
        </div>
        <div
          className={clsx(
            "layer-ui__wrapper__footer-right zen-mode-transition",
            {
              "transition-right disable-pointerEvents": appState.zenModeEnabled,
            },
          )}
        >
          {actionManager.renderAction("toggleShortcuts")}
        </div>
        <button
          className={clsx("disable-zen-mode", {
            "disable-zen-mode--visible": showExitZenModeBtn,
          })}
          onClick={() => actionManager.executeAction(actionToggleZenMode)}
        >
          {t("buttons.exitZenMode")}
        </button>
      </footer>
    );
  };

  const dialogs = (
    <>
      {appState.isLoading && <LoadingMessage delay={250} />}
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

  const renderStats = () => {
    if (!appState.showStats) {
      return null;
    }
    return (
      <Stats
        appState={appState}
        setAppState={setAppState}
        elements={elements}
        onClose={() => {
          actionManager.executeAction(actionToggleStats);
        }}
        renderCustomStats={renderCustomStats}
      />
    );
  };

  return device.isMobile ? (
    <>
      {dialogs}
      <MobileMenu
        actionManager={actionManager}
        libraryMenu={libraryMenu}
        renderJSONExportDialog={renderJSONExportDialog}
        renderImageExportDialog={renderImageExportDialog}
        setAppState={setAppState}
        onCollabButtonClick={onCollabButtonClick}
        onLockToggle={() => onLockToggle()}
        onPenModeToggle={onPenModeToggle}
        canvas={canvas}
        isCollaborating={isCollaborating}
        renderCustomFooter={renderCustomFooter}
        showThemeBtn={showThemeBtn}
        onImageAction={onImageAction}
        renderTopRightUI={renderTopRightUI}
        renderStats={renderStats}
      />
    </>
  ) : (
    <>
      <div
        className={clsx("layer-ui__wrapper", {
          "disable-pointerEvents":
            appState.draggingElement ||
            appState.resizingElement ||
            (appState.editingElement &&
              !isTextElement(appState.editingElement)),
        })}
        style={
          appState.isLibraryOpen &&
          appState.isLibraryMenuDocked &&
          device.canDeviceFitSidebar
            ? { width: `calc(100% - ${LIBRARY_SIDEBAR_WIDTH}px)` }
            : {}
        }
      >
        {dialogs}
        {renderFixedSideContainer()}
        {renderBottomAppMenu()}
        {renderStats()}
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
      {appState.isLibraryOpen && (
        <div className="layer-ui__sidebar">{libraryMenu}</div>
      )}
    </>
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
    prev.files === next.files &&
    keys.every((key) => prevAppState[key] === nextAppState[key])
  );
};

export default React.memo(LayerUI, areEqual);

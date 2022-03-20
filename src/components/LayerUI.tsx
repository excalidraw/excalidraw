import clsx from "clsx";
import React, { useCallback } from "react";
import { ActionManager } from "../actions/manager";
import { CLASSES } from "../constants";
import { exportCanvas } from "../data";
import { isTextElement, showSelectedShapeActions } from "../element";
import { NonDeletedExcalidrawElement } from "../element/types";
import { Language, t } from "../i18n";
import { calculateScrollCenter, getSelectedElements } from "../scene";
import { ExportType } from "../scene/types";
import {
  AppProps,
  AppState,
  ExcalidrawProps,
  BinaryFiles,
  DeviceType,
} from "../types";
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
import { Tooltip } from "./Tooltip";
import { UserList } from "./UserList";
import Library from "../data/library";
import { JSONExportDialog } from "./JSONExportDialog";
import { LibraryButton } from "./LibraryButton";
import { isImageFileHandle } from "../data/blob";
import { LibraryMenu } from "./LibraryMenu";

import "./LayerUI.scss";
import "./Toolbar.scss";
import { PenModeButton } from "./PenModeButton";
import { useDeviceType } from "../components/App";

interface LayerUIProps {
  actionManager: ActionManager;
  appState: AppState;
  files: BinaryFiles;
  canvas: HTMLCanvasElement | null;
  setAppState: React.Component<any, AppState>["setState"];
  setDeviceType: (obj: Partial<DeviceType>) => void;
  elements: readonly NonDeletedExcalidrawElement[];
  onCollabButtonClick?: () => void;
  onLockToggle: () => void;
  onPenModeToggle: () => void;
  onInsertElements: (elements: readonly NonDeletedExcalidrawElement[]) => void;
  zenModeEnabled: boolean;
  showExitZenModeBtn: boolean;
  showThemeBtn: boolean;
  toggleZenMode: () => void;
  langCode: Language["code"];
  isCollaborating: boolean;
  renderTopRightUI?: (
    isMobile: boolean,
    appState: AppState,
  ) => JSX.Element | null;
  renderCustomFooter?: (isMobile: boolean, appState: AppState) => JSX.Element;
  viewModeEnabled: boolean;
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
  setDeviceType,
  canvas,
  elements,
  onCollabButtonClick,
  onLockToggle,
  onPenModeToggle,
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
  onImageAction,
}: LayerUIProps) => {
  const deviceType = useDeviceType();

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
          // we want to make sure this doesn't overflow so subtracting 200
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
      onInsertShape={onInsertElements}
      onAddToLibrary={deselectItems}
      setAppState={setAppState}
      libraryReturnUrl={libraryReturnUrl}
      focusContainer={focusContainer}
      library={library}
      theme={appState.theme}
      files={files}
      id={id}
      appState={appState}
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
                  <Stack.Row
                    gap={1}
                    className={clsx("App-toolbar-container", {
                      "zen-mode": zenModeEnabled,
                    })}
                  >
                    <PenModeButton
                      zenModeEnabled={zenModeEnabled}
                      checked={appState.penMode}
                      onChange={onPenModeToggle}
                      title={t("toolBar.penMode")}
                      penDetected={deviceType.penDetected}
                    />
                    <LockButton
                      zenModeEnabled={zenModeEnabled}
                      checked={appState.elementLocked}
                      onChange={onLockToggle}
                      title={t("toolBar.lock")}
                    />
                    <Island
                      padding={1}
                      className={clsx("App-toolbar", {
                        "zen-mode": zenModeEnabled,
                      })}
                    >
                      <HintViewer
                        appState={appState}
                        elements={elements}
                        isMobile={deviceType.isMobile}
                      />
                      {heading}
                      <Stack.Row gap={1}>
                        <ShapesSwitcher
                          appState={appState}
                          canvas={canvas}
                          elementType={appState.elementType}
                          setAppState={setAppState}
                          onImageAction={({ pointerType }) => {
                            onImageAction({
                              insertOnCanvasDirectly: pointerType !== "mouse",
                            });
                          }}
                          penDetected={deviceType.penDetected}
                          setDeviceType={setDeviceType}
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
            {renderTopRightUI?.(deviceType.isMobile, appState)}
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
                <>
                  <div
                    className={clsx("undo-redo-buttons zen-mode-transition", {
                      "layer-ui__wrapper__footer-left--transition-bottom":
                        zenModeEnabled,
                    })}
                  >
                    {actionManager.renderAction("undo", { size: "small" })}
                    {actionManager.renderAction("redo", { size: "small" })}
                  </div>

                  <div
                    className={clsx("eraser-buttons zen-mode-transition", {
                      "layer-ui__wrapper__footer-left--transition-left":
                        zenModeEnabled,
                    })}
                  >
                    {actionManager.renderAction("eraser", { size: "small" })}
                  </div>
                </>
              )}
              {!viewModeEnabled &&
                appState.multiElement &&
                deviceType.isTouchScreen && (
                  <div
                    className={clsx("finalize-button zen-mode-transition", {
                      "layer-ui__wrapper__footer-left--transition-left":
                        zenModeEnabled,
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
                zenModeEnabled,
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

  return deviceType.isMobile ? (
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
        onPenModeToggle={onPenModeToggle}
        canvas={canvas}
        isCollaborating={isCollaborating}
        renderCustomFooter={renderCustomFooter}
        viewModeEnabled={viewModeEnabled}
        showThemeBtn={showThemeBtn}
        onImageAction={onImageAction}
        renderTopRightUI={renderTopRightUI}
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
    prev.files === next.files &&
    keys.every((key) => prevAppState[key] === nextAppState[key])
  );
};

export default React.memo(LayerUI, areEqual);

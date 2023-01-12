import clsx from "clsx";
import React from "react";
import { ActionManager } from "../actions/manager";
import { CLASSES, LIBRARY_SIDEBAR_WIDTH } from "../constants";
import { exportCanvas } from "../data";
import { isTextElement, showSelectedShapeActions } from "../element";
import { NonDeletedExcalidrawElement } from "../element/types";
import { Language, t } from "../i18n";
import { calculateScrollCenter } from "../scene";
import { ExportType } from "../scene/types";
import {
  AppProps,
  AppState,
  ExcalidrawProps,
  BinaryFiles,
  UIChildrenComponents,
  UIWelcomeScreenComponents,
} from "../types";
import { isShallowEqual, muteFSAbortError, getReactChildren } from "../utils";
import { SelectedShapeActions, ShapesSwitcher } from "./Actions";
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
import Library from "../data/library";
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
import Footer from "./footer/Footer";
import WelcomeScreen from "./welcome-screen/WelcomeScreen";
import { hostSidebarCountersAtom } from "./Sidebar/Sidebar";
import { jotaiScope } from "../jotai";
import { useAtom } from "jotai";
import MainMenu from "./main-menu/MainMenu";

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
  langCode: Language["code"];
  isCollaborating: boolean;
  renderTopRightUI?: ExcalidrawProps["renderTopRightUI"];
  renderCustomStats?: ExcalidrawProps["renderCustomStats"];
  renderCustomSidebar?: ExcalidrawProps["renderSidebar"];
  libraryReturnUrl: ExcalidrawProps["libraryReturnUrl"];
  UIOptions: AppProps["UIOptions"];
  focusContainer: () => void;
  library: Library;
  id: string;
  onImageAction: (data: { insertOnCanvasDirectly: boolean }) => void;
  renderWelcomeScreen: boolean;
  children?: React.ReactNode;
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
  isCollaborating,
  renderTopRightUI,
  renderCustomStats,
  renderCustomSidebar,
  libraryReturnUrl,
  UIOptions,
  focusContainer,
  library,
  id,
  onImageAction,
  renderWelcomeScreen,
  children,
}: LayerUIProps) => {
  const device = useDevice();

  const [childrenComponents, restChildren] =
    getReactChildren<UIChildrenComponents>(children, {
      Menu: true,
      FooterCenter: true,
      WelcomeScreen: true,
    });

  const [WelcomeScreenComponents] = getReactChildren<UIWelcomeScreenComponents>(
    renderWelcomeScreen
      ? (
          childrenComponents?.WelcomeScreen ?? (
            <WelcomeScreen>
              <WelcomeScreen.Center />
              <WelcomeScreen.Hints.MenuHint />
              <WelcomeScreen.Hints.ToolbarHint />
              <WelcomeScreen.Hints.HelpHint />
            </WelcomeScreen>
          )
        )?.props?.children
      : null,
  );

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
        setAppState={setAppState}
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
        setAppState={setAppState}
        files={files}
        actionManager={actionManager}
        onExportToPng={createExporter("png")}
        onExportToSvg={createExporter("svg")}
        onExportToClipboard={createExporter("clipboard")}
      />
    );
  };

  const renderMenu = () => {
    return (
      childrenComponents.Menu || (
        <MainMenu>
          <MainMenu.DefaultItems.LoadScene />
          <MainMenu.DefaultItems.SaveToActiveFile />
          {/* FIXME we should to test for this inside the item itself */}
          {UIOptions.canvasActions.export && <MainMenu.DefaultItems.Export />}
          {/* FIXME we should to test for this inside the item itself */}
          {UIOptions.canvasActions.saveAsImage && (
            <MainMenu.DefaultItems.SaveAsImage />
          )}
          {onCollabButtonClick && (
            <MainMenu.DefaultItems.LiveCollaboration
              onSelect={onCollabButtonClick}
              isCollaborating={isCollaborating}
            />
          )}
          <MainMenu.DefaultItems.Help />
          <MainMenu.DefaultItems.ClearCanvas />
          <MainMenu.Separator />
          <MainMenu.Group title="Excalidraw links">
            <MainMenu.DefaultItems.Socials />
          </MainMenu.Group>
          <MainMenu.Separator />
          <MainMenu.DefaultItems.ToggleTheme />
          <MainMenu.DefaultItems.ChangeCanvasBackground />
        </MainMenu>
      )
    );
  };
  const renderCanvasActions = () => (
    <div style={{ position: "relative" }}>
      {WelcomeScreenComponents.MenuHint}
      {/* wrapping to Fragment stops React from occasionally complaining
                about identical Keys */}
      <>{renderMenu()}</>
    </div>
  );

  const renderSelectedShapeActions = () => (
    <Section
      heading="selectedShapeActions"
      className={clsx("selected-shape-actions zen-mode-transition", {
        "transition-left": appState.zenModeEnabled,
      })}
    >
      <Island
        className={CLASSES.SHAPE_ACTIONS_MENU}
        padding={2}
        style={{
          // we want to make sure this doesn't overflow so subtracting the
          // approximate height of hamburgerMenu + footer
          maxHeight: `${appState.height - 166}px`,
        }}
      >
        <SelectedShapeActions
          appState={appState}
          elements={elements}
          renderAction={actionManager.renderAction}
        />
      </Island>
    </Section>
  );

  const renderFixedSideContainer = () => {
    const shouldRenderSelectedShapeActions = showSelectedShapeActions(
      appState,
      elements,
    );

    return (
      <FixedSideContainer side="top">
        {WelcomeScreenComponents.Center}
        <div className="App-menu App-menu_top">
          <Stack.Col
            gap={6}
            className={clsx("App-menu_top__left", {
              "disable-pointerEvents": appState.zenModeEnabled,
            })}
          >
            {renderCanvasActions()}
            {shouldRenderSelectedShapeActions && renderSelectedShapeActions()}
          </Stack.Col>
          {!appState.viewModeEnabled && (
            <Section heading="shapes" className="shapes-section">
              {(heading: React.ReactNode) => (
                <div style={{ position: "relative" }}>
                  {WelcomeScreenComponents.ToolbarHint}
                  <Stack.Col gap={4} align="start">
                    <Stack.Row
                      gap={1}
                      className={clsx("App-toolbar-container", {
                        "zen-mode": appState.zenModeEnabled,
                      })}
                    >
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
                          device={device}
                        />
                        {heading}
                        <Stack.Row gap={1}>
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
                          <div className="App-toolbar__divider"></div>

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
                          {/* {actionManager.renderAction("eraser", {
                          // size: "small",
                        })} */}
                        </Stack.Row>
                      </Island>
                    </Stack.Row>
                  </Stack.Col>
                </div>
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
            <UserList collaborators={appState.collaborators} />
            {onCollabButtonClick && (
              <CollabButton
                isCollaborating={isCollaborating}
                collaboratorCount={appState.collaborators.size}
                onClick={onCollabButtonClick}
              />
            )}
            {renderTopRightUI?.(device.isMobile, appState)}
            {!appState.viewModeEnabled && (
              <LibraryButton appState={appState} setAppState={setAppState} />
            )}
          </div>
        </div>
      </FixedSideContainer>
    );
  };

  const renderSidebars = () => {
    return appState.openSidebar === "customSidebar" ? (
      renderCustomSidebar?.() || null
    ) : appState.openSidebar === "library" ? (
      <LibraryMenu
        appState={appState}
        onInsertElements={onInsertElements}
        libraryReturnUrl={libraryReturnUrl}
        focusContainer={focusContainer}
        library={library}
        id={id}
      />
    ) : null;
  };

  const [hostSidebarCounters] = useAtom(hostSidebarCountersAtom, jotaiScope);

  return (
    <>
      {restChildren}
      {appState.isLoading && <LoadingMessage delay={250} />}
      {appState.errorMessage && (
        <ErrorDialog
          message={appState.errorMessage}
          onClose={() => setAppState({ errorMessage: null })}
        />
      )}
      {appState.openDialog === "help" && (
        <HelpDialog
          onClose={() => {
            setAppState({ openDialog: null });
          }}
        />
      )}
      {renderImageExportDialog()}
      {renderJSONExportDialog()}
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
      {device.isMobile && (
        <MobileMenu
          appState={appState}
          elements={elements}
          actionManager={actionManager}
          renderJSONExportDialog={renderJSONExportDialog}
          renderImageExportDialog={renderImageExportDialog}
          setAppState={setAppState}
          onLockToggle={() => onLockToggle()}
          onPenModeToggle={onPenModeToggle}
          canvas={canvas}
          onImageAction={onImageAction}
          renderTopRightUI={renderTopRightUI}
          renderCustomStats={renderCustomStats}
          renderSidebars={renderSidebars}
          device={device}
          renderMenu={renderMenu}
          welcomeScreenCenter={WelcomeScreenComponents.Center}
        />
      )}

      {!device.isMobile && (
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
              ((appState.openSidebar === "library" &&
                appState.isSidebarDocked) ||
                hostSidebarCounters.docked) &&
              device.canDeviceFitSidebar
                ? { width: `calc(100% - ${LIBRARY_SIDEBAR_WIDTH}px)` }
                : {}
            }
          >
            {renderFixedSideContainer()}
            <Footer
              appState={appState}
              actionManager={actionManager}
              showExitZenModeBtn={showExitZenModeBtn}
              footerCenter={childrenComponents.FooterCenter}
              welcomeScreenHelp={WelcomeScreenComponents.HelpHint}
            />
            {appState.showStats && (
              <Stats
                appState={appState}
                setAppState={setAppState}
                elements={elements}
                onClose={() => {
                  actionManager.executeAction(actionToggleStats);
                }}
                renderCustomStats={renderCustomStats}
              />
            )}
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
          {renderSidebars()}
        </>
      )}
    </>
  );
};

const stripIrrelevantAppStateProps = (
  appState: AppState,
): Partial<AppState> => {
  const { suggestedBindings, startBoundElement, cursorButton, ...ret } =
    appState;
  return ret;
};

const areEqual = (prevProps: LayerUIProps, nextProps: LayerUIProps) => {
  // short-circuit early
  if (prevProps.children !== nextProps.children) {
    return false;
  }

  const {
    canvas: _prevCanvas,
    // not stable, but shouldn't matter in our case
    onInsertElements: _prevOnInsertElements,
    appState: prevAppState,
    ...prev
  } = prevProps;
  const {
    canvas: _nextCanvas,
    onInsertElements: _nextOnInsertElements,
    appState: nextAppState,
    ...next
  } = nextProps;

  return (
    isShallowEqual(
      stripIrrelevantAppStateProps(prevAppState),
      stripIrrelevantAppStateProps(nextAppState),
    ) && isShallowEqual(prev, next)
  );
};

export default React.memo(LayerUI, areEqual);

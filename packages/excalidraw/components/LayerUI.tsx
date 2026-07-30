import clsx from "clsx";
import React from "react";

import {
  CLASSES,
  DEFAULT_SIDEBAR,
  TOOL_TYPE,
  arrayToMap,
  capitalizeString,
  isShallowEqual,
} from "@excalidraw/common";

import { mutateElement } from "@excalidraw/element";

import { showSelectedShapeActions } from "@excalidraw/element";

import { ShapeCache } from "@excalidraw/element";

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

import { actionShortcuts, actionToggleStats } from "../actions";
import { trackEvent } from "../analytics";
import { TunnelsContext, useInitializeTunnels } from "../context/tunnels";
import { UIAppStateContext } from "../context/ui-appState";
import { useAtom, useAtomValue } from "../editor-jotai";

import { t } from "../i18n";
import { getScrollToContentState } from "../scene";

import {
  SelectedShapeActions,
  CompactShapeActions,
  ExitZenModeButton,
  UndoRedoActions,
  ZoomActions,
} from "./Actions";
import { LoadingMessage } from "./LoadingMessage";
import { MobileMenu } from "./MobileMenu";
import { PasteChartDialog } from "./PasteChartDialog";
import { Section } from "./Section";
import Stack from "./Stack";
import { UserList } from "./UserList";
import { PenModeButton } from "./PenModeButton";
import { isSidebarDockedAtom } from "./Sidebar/Sidebar";
import MainMenu from "./main-menu/MainMenu";
import { ActiveConfirmDialog } from "./ActiveConfirmDialog";
import { useEditorInterface, useStylesPanelMode } from "./App";
import { OverwriteConfirmDialog } from "./OverwriteConfirm/OverwriteConfirm";
import { sidebarRightIcon } from "./icons";
import { DefaultSidebar } from "./DefaultSidebar";
import { TTDDialog } from "./TTDDialog/TTDDialog";
import { Stats } from "./Stats";
import ElementLinkDialog from "./ElementLinkDialog";
import { ErrorDialog } from "./ErrorDialog";
import { EyeDropper, activeEyeDropperAtom } from "./EyeDropper";
import { HelpButton } from "./HelpButton";
import { HelpDialog } from "./HelpDialog";
import { ImageExportDialog } from "./ImageExportDialog";
import { Island } from "./Island";
import { JSONExportDialog } from "./JSONExportDialog";
import { LaserPointerButton } from "./LaserPointerButton";
import { Toast } from "./Toast";
import { Toolbar } from "./Toolbar";

import "./LayerUI.scss";
import "./Toolbar.scss";

import type { ActionManager } from "../actions/manager";

import type { Language } from "../i18n";
import type {
  AppProps,
  AppState,
  ExcalidrawProps,
  BinaryFiles,
  UIAppState,
  AppClassProperties,
} from "../types";

interface LayerUIProps {
  actionManager: ActionManager;
  appState: UIAppState;
  files: BinaryFiles;
  canvas: HTMLCanvasElement;
  setAppState: React.Component<any, AppState>["setState"];
  elements: readonly NonDeletedExcalidrawElement[];
  onLockToggle: () => void;
  onPenModeToggle: AppClassProperties["togglePenMode"];
  showExitZenModeBtn: boolean;
  langCode: Language["code"];
  renderTopLeftUI?: ExcalidrawProps["renderTopLeftUI"];
  renderTopRightUI?: ExcalidrawProps["renderTopRightUI"];
  renderCustomStats?: ExcalidrawProps["renderCustomStats"];
  UIOptions: AppProps["UIOptions"];
  onExportImage: AppClassProperties["onExportImage"];
  renderWelcomeScreen: boolean;
  children?: React.ReactNode;
  app: AppClassProperties;
  defaultUIEnabled: boolean;
  zoomUIEnabled: boolean;
  scrollBackToContentUIEnabled: boolean;
  isCollaborating: boolean;
  generateLinkForSelection?: AppProps["generateLinkForSelection"];
}

const DefaultMainMenu: React.FC<{
  UIOptions: AppProps["UIOptions"];
}> = ({ UIOptions }) => {
  return (
    <MainMenu __fallback>
      <MainMenu.DefaultItems.LoadScene />
      <MainMenu.DefaultItems.SaveToActiveFile />
      {/* FIXME we should to test for this inside the item itself */}
      {UIOptions.canvasActions.export && <MainMenu.DefaultItems.Export />}
      {/* FIXME we should to test for this inside the item itself */}
      {UIOptions.canvasActions.saveAsImage && (
        <MainMenu.DefaultItems.SaveAsImage />
      )}
      <MainMenu.DefaultItems.SearchMenu />
      <MainMenu.DefaultItems.Help />
      <MainMenu.DefaultItems.ClearCanvas />
      <MainMenu.Separator />
      <MainMenu.Group title="Excalidraw links">
        <MainMenu.DefaultItems.Socials />
      </MainMenu.Group>
      <MainMenu.Separator />
      <MainMenu.DefaultItems.ToggleTheme allowSystemTheme={false} />
      <MainMenu.DefaultItems.ChangeCanvasBackground />
    </MainMenu>
  );
};

const DefaultOverwriteConfirmDialog = () => {
  return (
    <OverwriteConfirmDialog __fallback>
      <OverwriteConfirmDialog.Actions.SaveToDisk />
      <OverwriteConfirmDialog.Actions.ExportToImage />
    </OverwriteConfirmDialog>
  );
};

const LayerUI = ({
  actionManager,
  appState,
  files,
  setAppState,
  elements,
  canvas,
  onLockToggle,
  onPenModeToggle,
  showExitZenModeBtn,
  renderTopLeftUI,
  renderTopRightUI,
  renderCustomStats,
  UIOptions,
  onExportImage,
  renderWelcomeScreen,
  children,
  app,
  defaultUIEnabled,
  zoomUIEnabled,
  scrollBackToContentUIEnabled,
  isCollaborating,
  generateLinkForSelection,
}: LayerUIProps) => {
  const editorInterface = useEditorInterface();
  const stylesPanelMode = useStylesPanelMode();
  const isCompactStylesPanel = stylesPanelMode === "compact";
  const tunnels = useInitializeTunnels();

  const spacing = isCompactStylesPanel
    ? {
        menuTopGap: 4,
        toolbarColGap: 4,
        toolbarRowGap: 1,
        toolbarInnerRowGap: 0.5,
        islandPadding: 1,
        collabMarginLeft: 8,
      }
    : {
        menuTopGap: 6,
        toolbarColGap: 4,
        toolbarRowGap: 1,
        toolbarInnerRowGap: 1,
        islandPadding: 1,
        collabMarginLeft: 8,
      };

  const TunnelsJotaiProvider = tunnels.tunnelsJotai.Provider;

  const [eyeDropperState, setEyeDropperState] = useAtom(activeEyeDropperAtom);

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
    if (
      !UIOptions.canvasActions.saveAsImage ||
      appState.openDialog?.name !== "imageExport"
    ) {
      return null;
    }

    return (
      <ImageExportDialog
        elements={elements}
        appState={appState}
        files={files}
        actionManager={actionManager}
        onExportImage={onExportImage}
        onCloseRequest={() => setAppState({ openDialog: null })}
        name={app.getName()}
      />
    );
  };

  const renderCanvasActions = () => (
    <div style={{ position: "relative" }}>
      <div className="exc-region-top-left-content">
        <div className="exc-region-top-left-host-slot">
          {renderTopLeftUI?.(false, appState)}
        </div>
        <tunnels.MainMenuTunnel.Out />
      </div>
      {renderWelcomeScreen && <tunnels.WelcomeScreenMenuHintTunnel.Out />}
    </div>
  );

  const renderSelectedShapeActions = () => {
    return (
      <Section
        heading="selectedShapeActions"
        className={clsx("selected-shape-actions zen-mode-transition", {
          "transition-left": appState.zenModeEnabled,
        })}
      >
        {isCompactStylesPanel ? (
          <Island
            className={clsx("compact-shape-actions-island")}
            padding={0}
            data-viewport-ui="side"
            data-viewport-ui-name="stylesPanel"
          >
            <CompactShapeActions
              appState={appState}
              elementsMap={app.scene.getNonDeletedElementsMap()}
              renderAction={actionManager.renderAction}
              app={app}
              setAppState={setAppState}
            />
          </Island>
        ) : (
          <Island
            className={CLASSES.SHAPE_ACTIONS_MENU}
            padding={2}
            data-viewport-ui="side"
            data-viewport-ui-name="stylesPanel"
          >
            <SelectedShapeActions
              appState={appState}
              elementsMap={app.scene.getNonDeletedElementsMap()}
              renderAction={actionManager.renderAction}
              app={app}
            />
          </Island>
        )}
      </Section>
    );
  };

  /**
   * The whole editor UI is laid out as a single grid of nine regions (see
   * `.exc-regions` in styles.scss for the how and why):
   *
   *   top-left     top-center     top-right
   *   center-left  center-center  center-right
   *   bottom-left  bottom-center  bottom-right
   */
  const renderUIRegions = () => {
    const shouldRenderSelectedShapeActions =
      defaultUIEnabled && showSelectedShapeActions(appState, elements);

    const shouldShowStats =
      defaultUIEnabled &&
      appState.stats.open &&
      !appState.zenModeEnabled &&
      !appState.viewModeEnabled &&
      appState.openDialog?.name !== "elementLinkSelector";

    const shouldRenderToolbar =
      defaultUIEnabled &&
      !appState.viewModeEnabled &&
      appState.openDialog?.name !== "elementLinkSelector";

    const shouldRenderCanvasActions =
      defaultUIEnabled || (zoomUIEnabled && app.isNavigationEnabled());

    return (
      <div
        className="exc-regions"
        style={
          {
            // gap between vertically stacked regions, e.g. between the
            // top-left menu and the styles panel below it
            "--exc-regions-row-gap": `calc(var(--space-factor) * ${spacing.menuTopGap})`,
          } as React.CSSProperties
        }
      >
        <div className="exc-region-top-left">{renderCanvasActions()}</div>
        <div className="exc-region-top-center">
          {shouldRenderToolbar && (
            <Section heading="shapes">
              {(heading: React.ReactNode) => (
                <div style={{ position: "relative" }}>
                  {renderWelcomeScreen && (
                    <tunnels.WelcomeScreenToolbarHintTunnel.Out />
                  )}
                  <Stack.Col gap={spacing.toolbarColGap} align="start">
                    <Stack.Row
                      gap={spacing.toolbarRowGap}
                      className={clsx("App-toolbar-container", {
                        "zen-mode": appState.zenModeEnabled,
                      })}
                    >
                      <Toolbar
                        app={app}
                        appState={appState}
                        setAppState={setAppState}
                        UIOptions={UIOptions}
                        onPenModeToggle={onPenModeToggle}
                        onLockToggle={onLockToggle}
                        heading={heading}
                      />
                      {isCollaborating && (
                        <Island
                          style={{
                            marginLeft: spacing.collabMarginLeft,
                            alignSelf: "center",
                            height: "fit-content",
                          }}
                        >
                          <LaserPointerButton
                            title={t("toolBar.laser")}
                            checked={
                              appState.activeTool.type === TOOL_TYPE.laser
                            }
                            onChange={() =>
                              app.setActiveTool({ type: TOOL_TYPE.laser })
                            }
                            isMobile
                          />
                        </Island>
                      )}
                    </Stack.Row>
                  </Stack.Col>
                </div>
              )}
            </Section>
          )}
        </div>
        <div
          className={clsx("exc-region-top-right zen-mode-transition", {
            "transition-right": appState.zenModeEnabled,
            "exc-region-top-right--compact": isCompactStylesPanel,
          })}
        >
          {defaultUIEnabled && appState.collaborators.size > 0 && (
            <UserList
              collaborators={appState.collaborators}
              userToFollow={appState.userToFollow?.socketId || null}
            />
          )}
          <div className="exc-region-top-right-host-slot">
            {renderTopRightUI?.(
              editorInterface.formFactor === "phone",
              appState,
            )}
          </div>
          {!appState.viewModeEnabled &&
            appState.openDialog?.name !== "elementLinkSelector" &&
            // hide button when sidebar docked
            (!isSidebarDocked ||
              appState.openSidebar?.name !== DEFAULT_SIDEBAR.name) && (
              <tunnels.DefaultSidebarTriggerTunnel.Out />
            )}
        </div>

        <div className="exc-region-center-left">
          {defaultUIEnabled && (
            <div
              className={clsx("selected-shape-actions-container", {
                "selected-shape-actions-container--compact":
                  isCompactStylesPanel,
              })}
            >
              {shouldRenderSelectedShapeActions && renderSelectedShapeActions()}
            </div>
          )}
          {/* in compact UI the pen mode button lives outside the toolbar, as
                a separate floating button below the compact actions menu
                (same as we render it on mobile); shown alongside the compact
                actions island, i.e. when a drawing tool or elements are
                selected */}
          {defaultUIEnabled &&
            isCompactStylesPanel &&
            !appState.viewModeEnabled &&
            shouldRenderSelectedShapeActions && (
              <PenModeButton
                checked={appState.penMode}
                onChange={() => onPenModeToggle(null)}
                title={t("toolBar.penMode")}
                isMobile
                penDetected={appState.penDetected}
              />
            )}
        </div>
        {/* reserved for canvas-centered UI (host content, empty states) */}
        <div className="exc-region-center-center" />
        <div className="exc-region-center-right">
          {shouldShowStats && (
            <Stats
              app={app}
              onClose={() => {
                actionManager.executeAction(actionToggleStats);
              }}
              renderCustomStats={renderCustomStats}
            />
          )}
        </div>

        <footer className="exc-region-bottom">
          <div className="exc-region-bottom-left">
            {shouldRenderCanvasActions && (
              <Section heading="canvasActions">
                {zoomUIEnabled && app.isNavigationEnabled() && (
                  <ZoomActions renderAction={actionManager.renderAction} />
                )}
                {defaultUIEnabled && !appState.viewModeEnabled && (
                  <UndoRedoActions
                    renderAction={actionManager.renderAction}
                    className={clsx("zen-mode-transition", {
                      "transition-bottom": appState.zenModeEnabled,
                    })}
                  />
                )}
              </Section>
            )}
          </div>
          <div className="exc-region-bottom-center">
            <tunnels.FooterCenterTunnel.Out />
          </div>
          <div
            className={clsx("exc-region-bottom-right zen-mode-transition", {
              "transition-right": appState.zenModeEnabled,
            })}
          >
            {(defaultUIEnabled || renderWelcomeScreen) && (
              <div style={{ position: "relative" }}>
                {renderWelcomeScreen && (
                  <tunnels.WelcomeScreenHelpHintTunnel.Out />
                )}
                {defaultUIEnabled && (
                  <HelpButton
                    onClick={() => actionManager.executeAction(actionShortcuts)}
                  />
                )}
              </div>
            )}
          </div>
        </footer>

        {(appState.toast ||
          (scrollBackToContentUIEnabled && appState.scrolledOutside)) && (
          <div className="floating-status-stack">
            {appState.toast && (
              <Toast
                message={appState.toast.message}
                onClose={() => setAppState({ toast: null })}
                duration={appState.toast.duration}
                closable={appState.toast.closable}
              />
            )}
            {!appState.toast &&
              scrollBackToContentUIEnabled &&
              appState.scrolledOutside && (
                <button
                  type="button"
                  className="scroll-back-to-content"
                  onClick={() => {
                    setAppState((appState) => ({
                      ...getScrollToContentState(elements, appState),
                    }));
                  }}
                >
                  {t("buttons.scrollBackToContent")}
                </button>
              )}
          </div>
        )}

        {/* pinned to the UI area rather than docked into a region, so that it
            doesn't slide out with the bottom-right region in zen mode */}
        {defaultUIEnabled && (
          <ExitZenModeButton
            actionManager={actionManager}
            showExitZenModeBtn={showExitZenModeBtn}
          />
        )}
      </div>
    );
  };

  const renderSidebars = () => {
    if (!defaultUIEnabled) {
      return null;
    }

    return (
      <DefaultSidebar
        __fallback
        onDock={(docked) => {
          trackEvent(
            "sidebar",
            `toggleDock (${docked ? "dock" : "undock"})`,
            `(${
              editorInterface.formFactor === "phone" ? "mobile" : "desktop"
            })`,
          );
        }}
      />
    );
  };

  const isSidebarDocked = useAtomValue(isSidebarDockedAtom);

  const layerUIJSX = (
    <>
      {/* ------------------------- tunneled UI ---------------------------- */}
      {/* make sure we render host app components first so that we can detect
          them first on initial render to optimize layout shift */}
      {children}
      {/* Fallback entry points are the default UI. Host components above keep
          rendering into the outlets below even when defaults are disabled. */}
      {defaultUIEnabled && (
        <>
          <DefaultMainMenu UIOptions={UIOptions} />
          <DefaultSidebar.Trigger
            __fallback
            icon={sidebarRightIcon}
            title={capitalizeString(t("toolBar.library"))}
            onToggle={(open) => {
              if (open) {
                trackEvent(
                  "sidebar",
                  `${DEFAULT_SIDEBAR.name} (open)`,
                  `button (${
                    editorInterface.formFactor === "phone"
                      ? "mobile"
                      : "desktop"
                  })`,
                );
              }
            }}
            tab={DEFAULT_SIDEBAR.defaultTab}
          />
        </>
      )}
      {/* Keep supporting surfaces available to host-supplied UI, including
          MainMenu.DefaultItems. */}
      <DefaultOverwriteConfirmDialog />
      {appState.openDialog?.name === "ttd" && <TTDDialog __fallback />}
      {/* ------------------------------------------------------------------ */}

      {defaultUIEnabled && appState.isLoading && <LoadingMessage delay={250} />}
      {defaultUIEnabled && appState.errorMessage && (
        <ErrorDialog onClose={() => setAppState({ errorMessage: null })}>
          {appState.errorMessage}
        </ErrorDialog>
      )}
      {defaultUIEnabled &&
        eyeDropperState &&
        editorInterface.formFactor !== "phone" && (
          <EyeDropper
            colorPickerType={eyeDropperState.colorPickerType}
            onCancel={() => {
              setEyeDropperState(null);
            }}
            onChange={(
              colorPickerType,
              color,
              selectedElements,
              { altKey },
            ) => {
              if (
                colorPickerType !== "elementBackground" &&
                colorPickerType !== "elementStroke"
              ) {
                return;
              }

              if (selectedElements.length) {
                for (const element of selectedElements) {
                  mutateElement(element, arrayToMap(elements), {
                    [altKey && eyeDropperState.swapPreviewOnAlt
                      ? colorPickerType === "elementBackground"
                        ? "strokeColor"
                        : "backgroundColor"
                      : colorPickerType === "elementBackground"
                      ? "backgroundColor"
                      : "strokeColor"]: color,
                  });
                  ShapeCache.delete(element);
                }
                app.scene.triggerUpdate();
              } else if (colorPickerType === "elementBackground") {
                setAppState({
                  currentItemBackgroundColor: color,
                });
              } else {
                setAppState({ currentItemStrokeColor: color });
              }
            }}
            onSelect={(color, event) => {
              setEyeDropperState((state) => {
                return state?.keepOpenOnAlt && event.altKey ? state : null;
              });
              eyeDropperState?.onSelect?.(color, event);
            }}
          />
        )}
      {appState.openDialog?.name === "help" && (
        <HelpDialog
          onClose={() => {
            setAppState({ openDialog: null });
          }}
        />
      )}
      <ActiveConfirmDialog />
      {defaultUIEnabled && appState.openDialog?.name === "elementLinkSelector" && (
        <ElementLinkDialog
          sourceElementId={appState.openDialog.sourceElementId}
          onClose={() => {
            setAppState({
              openDialog: null,
            });
          }}
          scene={app.scene}
          appState={appState}
          generateLinkForSelection={generateLinkForSelection}
        />
      )}
      <tunnels.OverwriteConfirmDialogTunnel.Out />
      {renderImageExportDialog()}
      {renderJSONExportDialog()}
      {defaultUIEnabled && appState.openDialog?.name === "charts" && (
        <PasteChartDialog
          data={appState.openDialog.data}
          rawText={appState.openDialog.rawText}
          onClose={() =>
            setAppState({
              openDialog: null,
            })
          }
        />
      )}
      {editorInterface.formFactor === "phone" && (
        <MobileMenu
          app={app}
          appState={appState}
          elements={elements}
          actionManager={actionManager}
          renderJSONExportDialog={renderJSONExportDialog}
          renderImageExportDialog={renderImageExportDialog}
          setAppState={setAppState}
          onPenModeToggle={onPenModeToggle}
          renderTopLeftUI={renderTopLeftUI}
          renderTopRightUI={renderTopRightUI}
          renderSidebars={renderSidebars}
          renderWelcomeScreen={renderWelcomeScreen}
          defaultUIEnabled={defaultUIEnabled}
          scrollBackToContentUIEnabled={scrollBackToContentUIEnabled}
        />
      )}
      {editorInterface.formFactor !== "phone" && (
        <>
          <div
            className="layer-ui__wrapper"
            style={
              appState.openSidebar &&
              isSidebarDocked &&
              editorInterface.canFitSidebar
                ? { width: `calc(100% - var(--right-sidebar-width))` }
                : {}
            }
          >
            {renderWelcomeScreen && <tunnels.WelcomeScreenCenterTunnel.Out />}
            {renderUIRegions()}
          </div>
          {renderSidebars()}
        </>
      )}
    </>
  );

  return (
    <UIAppStateContext.Provider value={appState}>
      <TunnelsJotaiProvider>
        <TunnelsContext.Provider value={tunnels}>
          {layerUIJSX}
        </TunnelsContext.Provider>
      </TunnelsJotaiProvider>
    </UIAppStateContext.Provider>
  );
};

const stripIrrelevantAppStateProps = (appState: AppState): UIAppState => {
  const {
    cursorButton,
    scrollX,
    scrollY,
    zoom,
    shouldCacheIgnoreZoom,
    snapLines,
    originSnapOffset,
    suggestedBinding,
    frameToHighlight,
    elementsToHighlight,
    ...ret
  } = appState;
  return ret;
};

const areEqual = (prevProps: LayerUIProps, nextProps: LayerUIProps) => {
  // short-circuit early
  if (prevProps.children !== nextProps.children) {
    return false;
  }

  const { canvas: _pC, appState: prevAppState, ...prev } = prevProps;
  const { canvas: _nC, appState: nextAppState, ...next } = nextProps;

  return (
    isShallowEqual(
      // asserting AppState because we're being passed the whole AppState
      // but resolve to only the UI-relevant props
      stripIrrelevantAppStateProps(prevAppState as AppState),
      stripIrrelevantAppStateProps(nextAppState as AppState),
      {
        selectedElementIds: isShallowEqual,
        selectedGroupIds: isShallowEqual,
      },
    ) && isShallowEqual(prev, next)
  );
};

export default React.memo(LayerUI, areEqual);

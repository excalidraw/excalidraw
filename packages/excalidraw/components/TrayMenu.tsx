import React, { useState } from "react";

import { showSelectedShapeActions } from "@excalidraw/element";

import clsx from "clsx";
import { getNonDeletedElements } from "@excalidraw/element";

import { KEYS } from "@excalidraw/common";

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

import type { EditorInterface } from "@excalidraw/common";

import { isHandToolActive } from "../appState";
import { useTunnels } from "../context/tunnels";
import { t } from "../i18n";
import { getScrollToContentState, isSomeElementSelected } from "../scene";
import { SCROLLBAR_WIDTH, SCROLLBAR_MARGIN } from "../scene/scrollbars";

import { actionToggleStats } from "../actions";

import { SelectedShapeActions, ZoomActions } from "./Actions";
import { useAppProps, useStylesPanelMode } from "./App";
import { FixedSideContainer } from "./FixedSideContainer";
import { HintViewer } from "./HintViewer";
import { ImageMenu } from "./ImageMenu";
import { Island } from "./Island";
import { LockButton } from "./LockButton";
import { PenModeButton } from "./PenModeButton";
import { Section } from "./Section";
import Stack from "./Stack";
import DropdownMenu from "./dropdownMenu/DropdownMenu";
import {
  EmbedIcon,
  DotsIcon,
  frameToolIcon,
  LassoIcon,
  laserPointerToolIcon,
  MagicIcon,
  mermaidLogoIcon,
} from "./icons";
import {
  ArrowToolButton,
  DiamondToolButton,
  EllipseToolButton,
  EraserToolButton,
  FreedrawToolButton,
  HandToolButton,
  isToolButtonDisabled,
  LineToolButton,
  RectangleToolButton,
  SelectionToolButton,
  TextToolButton,
  LassoToolButton,
} from "./Tools";

import { Stats } from "./Stats";

import type { ActionManager } from "../actions/manager";
import type {
  AppClassProperties,
  AppProps,
  AppState,
  ExcalidrawProps,
  UIAppState,
} from "../types";
import type { JSX } from "react";

type TrayMenuProps = {
  appState: UIAppState;
  actionManager: ActionManager;
  renderJSONExportDialog: () => React.ReactNode;
  renderImageExportDialog: () => React.ReactNode;
  setAppState: React.Component<any, AppState>["setState"];
  elements: readonly NonDeletedExcalidrawElement[];
  onLockToggle: () => void;
  onPenModeToggle: AppClassProperties["togglePenMode"];

  renderTopRightUI?: (
    isMobile: boolean,
    appState: UIAppState,
  ) => JSX.Element | null;
  renderCustomStats?: ExcalidrawProps["renderCustomStats"];
  renderSidebars: () => JSX.Element | null;
  editorInterface: EditorInterface;
  renderWelcomeScreen: boolean;
  UIOptions: AppProps["UIOptions"];
  app: AppClassProperties;
};

const TrayToolbar = ({
  app,
  appState,
  setAppState,
  UIOptions,
}: {
  app: AppClassProperties;
  appState: UIAppState;
  setAppState: React.Component<any, AppState>["setState"];
  UIOptions: AppProps["UIOptions"];
}) => {
  const { TTDDialogTriggerTunnel } = useTunnels();
  const { renderMermaid } = useAppProps(); //zsviczian
  const stylesPanelMode = useStylesPanelMode(); //zsviczian
  const [isExtraToolsMenuOpen, setIsExtraToolsMenuOpen] = useState(false);
  const [isImageMenuOpen, setIsImageMenuOpen] = useState(false); //zsviczian

  const activeTool = appState.activeTool;
  const toolProps = { app, activeTool };

  const isFullStylesPanel = stylesPanelMode === "full";
  const isTrayModePanel = stylesPanelMode === "tray"; //zsviczian

  const frameToolSelected = activeTool.type === "frame";
  const laserToolSelected = activeTool.type === "laser";
  const embeddableToolSelected = activeTool.type === "embeddable";
  const lassoToolSelected =
    (isFullStylesPanel || isTrayModePanel) &&
    activeTool.type === "lasso" &&
    app.state.preferredSelectionTool.type !== "lasso";

  const showLassoTool = isFullStylesPanel || isTrayModePanel; //zsviczian
  const showImageTool = UIOptions.tools?.image !== false;

  return (
    <>
      <HandToolButton {...toolProps} hideKeyBinding />
      {appState.preferredSelectionTool.type === "lasso" ? (
        <LassoToolButton {...toolProps} />
      ) : (
        <SelectionToolButton {...toolProps} />
      )}
      <RectangleToolButton {...toolProps} />
      <DiamondToolButton {...toolProps} />
      <EllipseToolButton {...toolProps} />
      <ArrowToolButton {...toolProps} />
      <LineToolButton {...toolProps} />
      <FreedrawToolButton {...toolProps} />
      <TextToolButton {...toolProps} />
      {showImageTool && (
        <ImageMenu
          app={app}
          open={isImageMenuOpen}
          onToggle={() => {
            if (!isImageMenuOpen) {
              setIsExtraToolsMenuOpen(false);
            }
            setIsImageMenuOpen(!isImageMenuOpen);
          }}
          onClose={() => setIsImageMenuOpen(false)}
        />
      )}
      <EraserToolButton {...toolProps} />

      <div className="App-toolbar__divider" />

      <DropdownMenu open={isExtraToolsMenuOpen}>
        <DropdownMenu.Trigger
          className={clsx("App-toolbar__extra-tools-trigger", {
            "App-toolbar__extra-tools-trigger--selected":
              frameToolSelected ||
              embeddableToolSelected ||
              lassoToolSelected ||
              (laserToolSelected && !app.props.isCollaborating),
          })}
          onToggle={() => {
            if (!isExtraToolsMenuOpen) {
              setIsImageMenuOpen(false); //zsviczian
            }
            setIsExtraToolsMenuOpen(!isExtraToolsMenuOpen);
            setAppState({ openMenu: null, openPopup: null });
          }}
          title={t("toolBar.extraTools")}
        >
          {frameToolSelected
            ? frameToolIcon
            : embeddableToolSelected
            ? EmbedIcon
            : laserToolSelected && !app.props.isCollaborating
            ? laserPointerToolIcon
            : lassoToolSelected
            ? LassoIcon
            : DotsIcon}
        </DropdownMenu.Trigger>
        <DropdownMenu.Content
          onClickOutside={() => setIsExtraToolsMenuOpen(false)}
          onSelect={() => setIsExtraToolsMenuOpen(false)}
          className="App-toolbar__extra-tools-dropdown"
        >
          <DropdownMenu.Item
            onSelect={() => app.setActiveTool({ type: "frame" })}
            icon={frameToolIcon}
            shortcut={KEYS.F.toLocaleUpperCase()}
            data-testid="toolbar-frame"
            selected={frameToolSelected}
            disabled={isToolButtonDisabled(app, "frame")}
          >
            {t("toolBar.frame")}
          </DropdownMenu.Item>
          <DropdownMenu.Item
            onSelect={() => app.setActiveTool({ type: "embeddable" })}
            icon={EmbedIcon}
            data-testid="toolbar-embeddable"
            selected={embeddableToolSelected}
            disabled={isToolButtonDisabled(app, "embeddable")}
          >
            {t("toolBar.embeddable")}
          </DropdownMenu.Item>
          <DropdownMenu.Item
            onSelect={() => app.setActiveTool({ type: "laser" })}
            icon={laserPointerToolIcon}
            data-testid="toolbar-laser"
            selected={laserToolSelected}
            shortcut={KEYS.K.toLocaleUpperCase()}
            disabled={isToolButtonDisabled(app, "laser")}
          >
            {t("toolBar.laser")}
          </DropdownMenu.Item>
          {showLassoTool && (
            <DropdownMenu.Item
              onSelect={() => app.setActiveTool({ type: "lasso" })}
              icon={LassoIcon}
              data-testid="toolbar-lasso"
              selected={lassoToolSelected}
              disabled={isToolButtonDisabled(app, "lasso")}
            >
              {t("toolBar.lasso")}
            </DropdownMenu.Item>
          )}
          <div style={{ margin: "6px 0", fontSize: 14, fontWeight: 600 }}>
            Generate
          </div>
          {app.props.aiEnabled !== false && <TTDDialogTriggerTunnel.Out />}
          {renderMermaid && ( //zsviczian
            <DropdownMenu.Item
              onSelect={() => app.setOpenDialog({ name: "ttd", tab: "mermaid" })}
              icon={mermaidLogoIcon}
              data-testid="toolbar-embeddable"
            >
              {t("toolBar.mermaidToExcalidraw")}
            </DropdownMenu.Item>
          )}
          {app.props.aiEnabled !== false && app.plugins.diagramToCode && (
            <DropdownMenu.Item
              onSelect={() => app.onMagicframeToolSelect()}
              icon={MagicIcon}
              data-testid="toolbar-magicframe"
              badge={<DropdownMenu.Item.Badge>AI</DropdownMenu.Item.Badge>}
              disabled={isToolButtonDisabled(app, "magicframe")}
            >
              {t("toolBar.magicframe")}
            </DropdownMenu.Item>
          )}
        </DropdownMenu.Content>
      </DropdownMenu>
    </>
  );
};

export const TrayMenu = ({
  appState,
  elements,
  actionManager,
  setAppState,
  onLockToggle,
  onPenModeToggle,
  renderTopRightUI,
  renderCustomStats,
  renderSidebars,
  editorInterface,
  renderWelcomeScreen,
  UIOptions,
  app,
}: TrayMenuProps) => {
  const {
    WelcomeScreenCenterTunnel,
    MainMenuTunnel,
    DefaultSidebarTriggerTunnel,
  } = useTunnels();
  const renderToolbar = () => {
    const shouldShowStats = //zsviczian
      appState.stats.open &&
      !appState.zenModeEnabled &&
      !appState.viewModeEnabled;

    return (
      <FixedSideContainer
        side="top"
        className="App-top-bar"
        sidepanelOpen={!!appState.openSidebar /*zsviczian*/}
      >
        {renderWelcomeScreen && <WelcomeScreenCenterTunnel.Out />}
        <Section heading="shapes">
          {(heading: React.ReactNode) => (
            <Stack.Col gap={4} align="center">
              <Stack.Row gap={1} className="App-toolbar-container">
                <Island padding={1} className="App-toolbar">
                  {heading}
                  <Stack.Row gap={1}>
                    <TrayToolbar
                      appState={appState}
                      setAppState={setAppState}
                      UIOptions={UIOptions}
                      app={app}
                    />
                  </Stack.Row>
                </Island>
                <div
                  className="tray-misc-tools-container"
                  style={
                    //zsviczian
                    document.body?.classList.contains("mod-rtl")
                      ? {
                          right: "inherit",
                          left: "calc(var(--editor-container-padding) * -1)",
                        }
                      : undefined
                  }
                >
                  {!appState.viewModeEnabled && //zsviczian
                    renderTopRightUI?.(editorInterface.formFactor === "phone", appState)}
                  {!appState.viewModeEnabled &&
                    appState.openDialog?.name !== "elementLinkSelector" && (
                      <DefaultSidebarTriggerTunnel.Out />
                    )}
                  <PenModeButton
                    checked={appState.penMode}
                    onChange={() => onPenModeToggle(null)}
                    title={t("toolBar.penMode")}
                    isMobile
                    penDetected={appState.penDetected}
                  />
                  <LockButton
                    checked={appState.activeTool.locked}
                    onChange={onLockToggle}
                    title={t("toolBar.lock")}
                    isMobile
                  />
                </div>
              </Stack.Row>
            </Stack.Col>
          )}
        </Section>
        <HintViewer
          appState={appState}
          isMobile={true}
          editorInterface={editorInterface}
          app={app}
        />
        <div //zsviczian
          className={clsx("layer-ui__wrapper__top-right zen-mode-transition", {
            "transition-right": appState.zenModeEnabled,
          })}
          style={{
            marginRight: "4rem",
          }}
        >
          {shouldShowStats && ( //zsviczian
            <Stats
              app={app}
              onClose={() => {
                actionManager.executeAction(actionToggleStats);
              }}
              renderCustomStats={renderCustomStats}
            />
          )}
        </div>
      </FixedSideContainer>
    );
  };

  const renderAppToolbar = () => {
    if (appState.viewModeEnabled) {
      return; //zsviczian
    }
    if (appState.openDialog?.name === "elementLinkSelector") {
      return (
        //zsviczian (see original below)
        <div className="App-toolbar-content">
          <MainMenuTunnel.Out />
        </div>
      );
    }
    /*
    if (
      appState.viewModeEnabled ||
      appState.openDialog?.name === "elementLinkSelector"
    ) {
      return (
        <div className="App-toolbar-content">
          <MainMenuTunnel.Out />
        </div>
      );
    }
    */

    //zsviczian fix mobile menu button positions
    const showEditMenu = showSelectedShapeActions(
      appState,
      getNonDeletedElements(elements),
    );
    const showElAction = isSomeElementSelected(
      getNonDeletedElements(elements),
      appState,
    );

    return (
      <div className="App-toolbar-content">
        <MainMenuTunnel.Out />
        {showEditMenu ? ( //zsviczian
          actionManager.renderAction("toggleTrayEditMenu")
        ) : (
          <div className="ToolIcon__icon" aria-hidden="true" />
        )}
        {showElAction || appState.multiElement ? ( //zsviczian
          actionManager.renderAction(
            appState.multiElement ? "finalize" : "duplicateSelection",
          )
        ) : (
          <div className="ToolIcon__icon" aria-hidden="true" />
        )}
        {showElAction ? ( //zsviczian
          actionManager.renderAction("deleteSelectedElements")
        ) : (
          <div className="ToolIcon__icon" aria-hidden="true" />
        )}
        <div>
          {actionManager.renderAction("undo")}
          {actionManager.renderAction("redo")}
        </div>
      </div>
    );
  };

  return (
    <>
      {renderSidebars()}
      {!appState.viewModeEnabled &&
        appState.openDialog?.name !== "elementLinkSelector" &&
        renderToolbar()}
      <div
        className="App-bottom-bar"
        style={{
          marginBottom: SCROLLBAR_WIDTH + SCROLLBAR_MARGIN, //* 2, zsviczian
          marginLeft: SCROLLBAR_WIDTH + SCROLLBAR_MARGIN * 2,
          marginRight: SCROLLBAR_WIDTH + SCROLLBAR_MARGIN * 2,
        }}
      >
        <Island padding={0}>
          {appState.openMenu === "shape" &&
          !appState.viewModeEnabled &&
          appState.openDialog?.name !== "elementLinkSelector" &&
          showSelectedShapeActions(appState, elements) ? (
            <Section
              className="App-tray-menu"
              heading="selectedShapeActions"
              style={{ maxHeight: app.state.height * 0.8 }}
            >
              <SelectedShapeActions
                appState={appState}
                elementsMap={app.scene.getNonDeletedElementsMap()}
                renderAction={actionManager.renderAction}
                app={app}
              />
            </Section>
          ) : null}
          <footer className="App-toolbar">
            {renderAppToolbar()}
            {appState.scrolledOutside &&
              !appState.openMenu &&
              !appState.openSidebar && (
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
          </footer>
        </Island>
        <Island padding={1} style={{ marginLeft: `4px` }}>
          <ZoomActions
            renderAction={actionManager.renderAction}
            trayMode={true}
          />
        </Island>
      </div>
    </>
  );
};

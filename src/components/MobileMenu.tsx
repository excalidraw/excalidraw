import React from "react";
import {
  AppClassProperties,
  AppState,
  Device,
  ExcalidrawProps,
  UIAppState,
} from "../types";
import { ActionManager } from "../actions/manager";
import { t } from "../i18n";
import Stack from "./Stack";
import { showSelectedShapeActions } from "../element";
import { NonDeletedExcalidrawElement } from "../element/types";
import { FixedSideContainer } from "./FixedSideContainer";
import { Island } from "./Island";
import { HintViewer } from "./HintViewer";
import { calculateScrollCenter } from "../scene";
import { SelectedShapeActions, ShapesSwitcher } from "./Actions";
import { Section } from "./Section";
import { SCROLLBAR_WIDTH, SCROLLBAR_MARGIN } from "../scene/scrollbars";
import { LockButton } from "./LockButton";
import { PenModeButton } from "./PenModeButton";
import { Stats } from "./Stats";
import { actionToggleStats } from "../actions";
import { HandButton } from "./HandButton";
import { isHandToolActive } from "../appState";
import { useTunnels } from "../context/tunnels";

type MobileMenuProps = {
  appState: UIAppState;
  actionManager: ActionManager;
  renderJSONExportDialog: () => React.ReactNode;
  renderImageExportDialog: () => React.ReactNode;
  setAppState: React.Component<any, AppState>["setState"];
  elements: readonly NonDeletedExcalidrawElement[];
  onLockToggle: () => void;
  onHandToolToggle: () => void;
  onPenModeToggle: () => void;
  interactiveCanvas: HTMLCanvasElement | null;

  onImageAction: (data: { insertOnCanvasDirectly: boolean }) => void;
  renderTopRightUI?: (
    isMobile: boolean,
    appState: UIAppState,
  ) => JSX.Element | null;
  renderCustomStats?: ExcalidrawProps["renderCustomStats"];
  renderSidebars: () => JSX.Element | null;
  device: Device;
  renderWelcomeScreen: boolean;
  app: AppClassProperties;
};

export const MobileMenu = ({
  appState,
  elements,
  actionManager,
  setAppState,
  onLockToggle,
  onHandToolToggle,
  onPenModeToggle,
  interactiveCanvas,
  onImageAction,
  renderTopRightUI,
  renderCustomStats,
  renderSidebars,
  device,
  renderWelcomeScreen,
  app,
}: MobileMenuProps) => {
  const {
    WelcomeScreenCenterTunnel,
    MainMenuTunnel,
    DefaultSidebarTriggerTunnel,
  } = useTunnels();
  const renderToolbar = () => {
    return (
      <FixedSideContainer side="top" className="App-top-bar">
        {renderWelcomeScreen && <WelcomeScreenCenterTunnel.Out />}
        <Section heading="shapes">
          {(heading: React.ReactNode) => (
            <Stack.Col gap={4} align="center">
              <Stack.Row gap={1} className="App-toolbar-container">
                <Island padding={1} className="App-toolbar App-toolbar--mobile">
                  {heading}
                  <Stack.Row gap={1}>
                    <ShapesSwitcher
                      appState={appState}
                      interactiveCanvas={interactiveCanvas}
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
                {renderTopRightUI && renderTopRightUI(true, appState)}
                <div className="mobile-misc-tools-container">
                  {!appState.viewModeEnabled && (
                    <DefaultSidebarTriggerTunnel.Out />
                  )}
                  <PenModeButton
                    checked={appState.penMode}
                    onChange={onPenModeToggle}
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
                  <HandButton
                    checked={isHandToolActive(appState)}
                    onChange={() => onHandToolToggle()}
                    title={t("toolBar.hand")}
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
          device={device}
          app={app}
        />
      </FixedSideContainer>
    );
  };

  const renderAppToolbar = () => {
    if (appState.viewModeEnabled) {
      return (
        <div className="App-toolbar-content">
          <MainMenuTunnel.Out />
        </div>
      );
    }

    return (
      <div className="App-toolbar-content">
        <MainMenuTunnel.Out />
        {actionManager.renderAction("toggleEditMenu")}
        {actionManager.renderAction("undo")}
        {actionManager.renderAction("redo")}
        {actionManager.renderAction(
          appState.multiElement ? "finalize" : "duplicateSelection",
        )}
        {actionManager.renderAction("deleteSelectedElements")}
      </div>
    );
  };

  return (
    <>
      {renderSidebars()}
      {!appState.viewModeEnabled && renderToolbar()}
      {!appState.openMenu && appState.showStats && (
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
      <div
        className="App-bottom-bar"
        style={{
          marginBottom: SCROLLBAR_WIDTH + SCROLLBAR_MARGIN * 2,
          marginLeft: SCROLLBAR_WIDTH + SCROLLBAR_MARGIN * 2,
          marginRight: SCROLLBAR_WIDTH + SCROLLBAR_MARGIN * 2,
        }}
      >
        <Island padding={0}>
          {appState.openMenu === "shape" &&
          !appState.viewModeEnabled &&
          showSelectedShapeActions(appState, elements) ? (
            <Section className="App-mobile-menu" heading="selectedShapeActions">
              <SelectedShapeActions
                appState={appState}
                elements={elements}
                renderAction={actionManager.renderAction}
              />
            </Section>
          ) : null}
          <footer className="App-toolbar">
            {renderAppToolbar()}
            {appState.scrolledOutside &&
              !appState.openMenu &&
              !appState.openSidebar && (
                <button
                  className="scroll-back-to-content"
                  onClick={() => {
                    setAppState((appState) => ({
                      ...calculateScrollCenter(elements, appState),
                    }));
                  }}
                >
                  {t("buttons.scrollBackToContent")}
                </button>
              )}
          </footer>
        </Island>
      </div>
    </>
  );
};

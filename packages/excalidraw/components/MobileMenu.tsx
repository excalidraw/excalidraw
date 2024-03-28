import React from "react";
import { actionToggleStats } from "../actions";
import { ActionManager } from "../actions/manager";
import { isHandToolActive } from "../appState";
import { useTunnels } from "../context/tunnels";
import { showSelectedShapeActions } from "../element";
import { NonDeletedExcalidrawElement } from "../element/types";
import { t } from "../i18n";
import { calculateScrollCenter } from "../scene";
import { SCROLLBAR_MARGIN, SCROLLBAR_WIDTH } from "../scene/scrollbars";
import {
  AppClassProperties,
  AppProps,
  AppState,
  Device,
  ExcalidrawProps,
  UIAppState,
} from "../types";
import { SelectedShapeActions, ShapesSwitcher } from "./Actions";
import { FixedSideContainer } from "./FixedSideContainer";
import { HandButton } from "./HandButton";
import { HintViewer } from "./HintViewer";
import { Island } from "./Island";
import { LockButton } from "./LockButton";
import { PenModeButton } from "./PenModeButton";
import { Section } from "./Section";
import Stack from "./Stack";
import { Stats } from "./Stats";

type MobileMenuProps = {
  appState: UIAppState;
  actionManager: ActionManager;
  renderJSONExportDialog: () => React.ReactNode;
  renderImageExportDialog: () => React.ReactNode;
  setAppState: React.Component<any, AppState>["setState"];
  elements: readonly NonDeletedExcalidrawElement[];
  onLockToggle: () => void;
  onHandToolToggle: () => void;
  onPenModeToggle: AppClassProperties["togglePenMode"];

  renderTopRightUI?: (
    isMobile: boolean,
    appState: UIAppState,
  ) => JSX.Element | null;
  renderCustomStats?: ExcalidrawProps["renderCustomStats"];
  renderSidebars: () => JSX.Element | null;
  device: Device;
  renderWelcomeScreen: boolean;
  UIOptions: AppProps["UIOptions"];
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

  renderTopRightUI,
  renderCustomStats,
  renderSidebars,
  device,
  renderWelcomeScreen,
  UIOptions,
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
                <Island draggable padding={1} className="App-toolbar App-toolbar--mobile">
                  {heading}
                  <Stack.Row gap={1}>
                    <ShapesSwitcher
                      appState={appState}
                      activeTool={appState.activeTool}
                      UIOptions={UIOptions}
                      app={app}
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
        <Island draggable padding={0}>
          {appState.openMenu === "shape" &&
          !appState.viewModeEnabled &&
          showSelectedShapeActions(appState, elements) ? (
            <Section className="App-mobile-menu" heading="selectedShapeActions">
              <SelectedShapeActions
                appState={appState}
                elementsMap={app.scene.getNonDeletedElementsMap()}
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

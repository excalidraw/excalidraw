import React from "react";

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

import { useTunnels } from "../context/tunnels";
import { t } from "../i18n";
import { calculateScrollCenter } from "../scene";
import { SCROLLBAR_WIDTH, SCROLLBAR_MARGIN } from "../scene/scrollbars";

import { MobileShapeActions } from "./Actions";
import { MobileToolBar } from "./MobileToolBar";
import { FixedSideContainer } from "./FixedSideContainer";

import { Island } from "./Island";

import type { ActionManager } from "../actions/manager";
import type {
  AppClassProperties,
  AppProps,
  AppState,
  UIAppState,
} from "../types";
import type { JSX } from "react";

type MobileMenuProps = {
  appState: UIAppState;
  actionManager: ActionManager;
  renderJSONExportDialog: () => React.ReactNode;
  renderImageExportDialog: () => React.ReactNode;
  setAppState: React.Component<any, AppState>["setState"];
  elements: readonly NonDeletedExcalidrawElement[];
  onHandToolToggle: () => void;
  onPenModeToggle: AppClassProperties["togglePenMode"];

  renderTopRightUI?: (
    isMobile: boolean,
    appState: UIAppState,
  ) => JSX.Element | null;
  renderTopLeftUI?: (
    isMobile: boolean,
    appState: UIAppState,
  ) => JSX.Element | null;
  renderSidebars: () => JSX.Element | null;
  renderWelcomeScreen: boolean;
  UIOptions: AppProps["UIOptions"];
  app: AppClassProperties;
};

export const MobileMenu = ({
  appState,
  elements,
  actionManager,
  setAppState,
  onHandToolToggle,
  renderTopLeftUI,
  renderTopRightUI,
  renderSidebars,
  renderWelcomeScreen,
  UIOptions,
  app,
}: MobileMenuProps) => {
  const {
    WelcomeScreenCenterTunnel,
    MainMenuTunnel,
    DefaultSidebarTriggerTunnel,
  } = useTunnels();
  const renderAppTopBar = () => {
    const topRightUI = renderTopRightUI?.(true, appState) ?? (
      <DefaultSidebarTriggerTunnel.Out />
    );

    const topLeftUI = (
      <div className="excalidraw-ui-top-left">
        {renderTopLeftUI?.(true, appState)}
        <MainMenuTunnel.Out />
      </div>
    );

    if (
      appState.viewModeEnabled ||
      appState.openDialog?.name === "elementLinkSelector"
    ) {
      return <div className="App-toolbar-content">{topLeftUI}</div>;
    }

    return (
      <div
        className="App-toolbar-content"
        style={{
          display: "flex",
          flexDirection: "row",
          justifyContent: "space-between",
        }}
      >
        {topLeftUI}
        {topRightUI}
      </div>
    );
  };

  const renderToolbar = () => {
    return (
      <MobileToolBar
        app={app}
        onHandToolToggle={onHandToolToggle}
        setAppState={setAppState}
      />
    );
  };

  return (
    <>
      {renderSidebars()}
      {/* welcome screen, bottom bar, and top bar all have the same z-index */}
      {/* ordered in this reverse order so that top bar is on top */}
      <div className="App-welcome-screen">
        {renderWelcomeScreen && <WelcomeScreenCenterTunnel.Out />}
      </div>

      <div
        className="App-bottom-bar"
        style={{
          marginBottom: SCROLLBAR_WIDTH + SCROLLBAR_MARGIN,
        }}
      >
        <MobileShapeActions
          appState={appState}
          elementsMap={app.scene.getNonDeletedElementsMap()}
          renderAction={actionManager.renderAction}
          app={app}
          setAppState={setAppState}
        />

        <Island className="App-toolbar">
          {!appState.viewModeEnabled &&
            appState.openDialog?.name !== "elementLinkSelector" &&
            renderToolbar()}
          {appState.scrolledOutside &&
            !appState.openMenu &&
            !appState.openSidebar && (
              <button
                type="button"
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
        </Island>
      </div>

      <FixedSideContainer side="top" className="App-top-bar">
        {renderAppTopBar()}
      </FixedSideContainer>
    </>
  );
};

import React from "react";

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

import { useTunnels } from "../context/tunnels";
import { t } from "../i18n";
import { getScrollToContentState } from "../scene";
import { SCROLLBAR_WIDTH, SCROLLBAR_MARGIN } from "../scene/scrollbars";

import { ExitViewModeButton, MobileShapeActions } from "./Actions";
import { MobileToolbar } from "./MobileToolbar";
import { FixedSideContainer } from "./FixedSideContainer";

import { Island } from "./Island";

import { PenModeButton } from "./PenModeButton";

import type { ActionManager } from "../actions/manager";
import type {
  AppClassProperties,
  AppState,
  ExcalidrawProps,
  UIAppState,
} from "../types";
import type { JSX } from "react";
import clsx from "clsx";
import { Stats } from "./Stats";
import { actionToggleStats } from "../actions";

type MobileMenuProps = {
  appState: UIAppState;
  actionManager: ActionManager;
  renderJSONExportDialog: () => React.ReactNode;
  renderImageExportDialog: () => React.ReactNode;
  setAppState: React.Component<any, AppState>["setState"];
  elements: readonly NonDeletedExcalidrawElement[];
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
  defaultUIEnabled: boolean;
  scrollBackToContentUIEnabled: boolean;
  app: AppClassProperties;
  renderCustomStats?: ExcalidrawProps["renderCustomStats"]; //zsviczian
};

export const MobileMenu = ({
  appState,
  elements,
  actionManager,
  setAppState,
  renderTopLeftUI,
  renderTopRightUI,
  renderSidebars,
  renderWelcomeScreen,
  defaultUIEnabled,
  scrollBackToContentUIEnabled,
  app,
  renderCustomStats, //zsviczian
  onPenModeToggle,
}: MobileMenuProps) => {
  const {
    WelcomeScreenCenterTunnel,
    MainMenuTunnel,
    DefaultSidebarTriggerTunnel,
  } = useTunnels();
  const renderAppTopBar = () => {
    if (appState.openDialog?.name === "elementLinkSelector") {
      return null;
    }

    const topRightUI = (
      <>
        {!appState.viewModeEnabled && ( //zsviczian
          <div className="excalidraw-ui-top-right">
            {renderTopRightUI?.(true, appState)}
          </div>
        )}
        {!appState.viewModeEnabled && (
          <div className="excalidraw-ui-top-right library-and-pen">
            <PenModeButton
              checked={appState.penMode}
              onChange={() => onPenModeToggle(null)}
              title={t("toolBar.penMode")}
              isMobile
              penDetected={appState.penDetected}
            />
            <DefaultSidebarTriggerTunnel.Out />
          </div>
        )}
        {defaultUIEnabled &&
          appState.viewModeEnabled &&
          app.isInteractionEnabled() && (
            <div className="excalidraw-ui-top-right">
              <ExitViewModeButton actionManager={actionManager} />
            </div>
          )}
      </>
    );

    const topLeftUI = (
      <div className="excalidraw-ui-top-left">
        {renderTopLeftUI?.(true, appState)}
        <MainMenuTunnel.Out />
      </div>
    );

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
    return <MobileToolbar app={app} setAppState={setAppState} />;
  };

  const shouldShowStats = //zsviczian
    appState.stats.open &&
    !appState.zenModeEnabled &&
    !appState.viewModeEnabled;
  const shouldRenderScrollBackToContent =
    scrollBackToContentUIEnabled && appState.scrolledOutside;
  const shouldRenderDefaultBottomBar =
    defaultUIEnabled && !appState.viewModeEnabled;
  const scrollBackToContentButton =
    shouldRenderScrollBackToContent &&
    !appState.openMenu &&
    !appState.openSidebar ? (
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
    ) : null;

  return (
    <>
      {renderSidebars()}
      {/* welcome screen, bottom bar, and top bar all have the same z-index */}
      {/* ordered in this reverse order so that top bar is on top */}
      <div className="App-welcome-screen">
        {renderWelcomeScreen && <WelcomeScreenCenterTunnel.Out />}
      </div>

      {shouldRenderDefaultBottomBar && (
        <div
          className="App-bottom-bar"
          style={{
            marginBottom: SCROLLBAR_WIDTH + SCROLLBAR_MARGIN,
          }}
          data-viewport-ui="bottom"
        >
          <MobileShapeActions
            appState={appState}
            elementsMap={app.scene.getNonDeletedElementsMap()}
            renderAction={actionManager.renderAction}
            app={app}
            setAppState={setAppState}
          />

          <Island className="App-toolbar">
            {appState.openDialog?.name !== "elementLinkSelector" &&
              renderToolbar()}
            {scrollBackToContentButton}
          </Island>
        </div>
      )}

      {!shouldRenderDefaultBottomBar && scrollBackToContentButton && (
        <div className="floating-status-stack">{scrollBackToContentButton}</div>
      )}

      <FixedSideContainer side="top" className="App-top-bar">
        {renderAppTopBar()}
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
    </>
  );
};

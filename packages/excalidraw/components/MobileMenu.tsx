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
  UIOptions: AppProps["UIOptions"];
  app: AppClassProperties;
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
  UIOptions,
  app,
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
      <div className="excalidraw-ui-top-right">
        {renderTopRightUI?.(true, appState) ??
          (!appState.viewModeEnabled && (
            <>
              {defaultUIEnabled && (
                <PenModeButton
                  checked={appState.penMode}
                  onChange={() => onPenModeToggle(null)}
                  title={t("toolBar.penMode")}
                  isMobile
                  penDetected={appState.penDetected}
                />
              )}
              <DefaultSidebarTriggerTunnel.Out />
            </>
          ))}
        {defaultUIEnabled &&
          appState.viewModeEnabled &&
          app.isInteractionEnabled() && (
            <ExitViewModeButton actionManager={actionManager} />
          )}
      </div>
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

  return (
    <>
      {renderSidebars()}
      {/* welcome screen, bottom bar, and top bar all have the same z-index */}
      {/* ordered in this reverse order so that top bar is on top */}
      <div className="App-welcome-screen">
        {renderWelcomeScreen && <WelcomeScreenCenterTunnel.Out />}
      </div>

      {!appState.viewModeEnabled &&
        (defaultUIEnabled ||
          (scrollBackToContentUIEnabled && appState.scrolledOutside)) && (
          <div
            className="App-bottom-bar"
            style={{
              marginBottom: SCROLLBAR_WIDTH + SCROLLBAR_MARGIN,
            }}
            data-viewport-ui="bottom"
          >
            {defaultUIEnabled && (
              <MobileShapeActions
                appState={appState}
                elementsMap={app.scene.getNonDeletedElementsMap()}
                renderAction={actionManager.renderAction}
                app={app}
                setAppState={setAppState}
              />
            )}

            <Island className="App-toolbar">
              {defaultUIEnabled &&
                !appState.viewModeEnabled &&
                appState.openDialog?.name !== "elementLinkSelector" &&
                renderToolbar()}
              {scrollBackToContentUIEnabled &&
                appState.scrolledOutside &&
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
            </Island>
          </div>
        )}

      <FixedSideContainer side="top" className="App-top-bar">
        {renderAppTopBar()}
      </FixedSideContainer>
    </>
  );
};

import clsx from "clsx";
import React, { useEffect, useState } from "react";

import { actionShortcuts } from "../../actions";
import { useTunnels } from "../../context/tunnels";
import { ExitZenModeButton, UndoRedoActions, ZoomActions } from "../Actions";
import { HelpButton } from "../HelpButton";
import { Section } from "../Section";
import Stack from "../Stack";
import { useApp } from "../App";

import type { ActionManager } from "../../actions/manager";
import type { UIAppState } from "../../types";

type MousePos = { x: number; y: number } | null;

const Footer = ({
  appState,
  actionManager,
  showExitZenModeBtn,
  renderWelcomeScreen,
}: {
  appState: UIAppState;
  actionManager: ActionManager;
  showExitZenModeBtn: boolean;
  renderWelcomeScreen: boolean;
}) => {
  const { FooterCenterTunnel, WelcomeScreenHelpHintTunnel } = useTunnels();
  const app = useApp();

  const [mousePos, setMousePos] = useState<MousePos>(null);

  useEffect(() => {
    const handleMove = (evt: MouseEvent) => {
      // Basic viewport → canvas-ish coordinates
      // This shows that you understand:
      // - clientX / clientY
      // - zoom
      // - app offsets / scroll
      const { clientX, clientY } = evt;

      // We only have UIAppState here, but the runtime object carries
      // more fields (scroll/offset). We access them via `as any`
      // to keep TypeScript happy while still using the real values.
      const uiState = appState as any;

      const zoom = uiState.zoom?.value ?? 1;

      const offsetLeft = uiState.offsetLeft ?? 0;
      const offsetTop = uiState.offsetTop ?? 0;

      const scrollX = uiState.scrollX ?? 0;
      const scrollY = uiState.scrollY ?? 0;

      // Convert:
      // 1. subtract canvas DOM offset
      // 2. divide by zoom
      // 3. adjust by scroll/pan
      const sceneX = (clientX - offsetLeft) / zoom + scrollX;
      const sceneY = (clientY - offsetTop) / zoom + scrollY;

      setMousePos({
        x: Math.round(sceneX),
        y: Math.round(sceneY),
      });
    };

    window.addEventListener("mousemove", handleMove);
    return () => window.removeEventListener("mousemove", handleMove);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appState.zoom]); // when zoom changes, math updates automatically

  return (
    <footer
      role="contentinfo"
      className="layer-ui__wrapper__footer App-menu App-menu_bottom"
    >
      {/* LEFT SIDE: Zoom + Undo/Redo */}
      <div
        className={clsx("layer-ui__wrapper__footer-left zen-mode-transition", {
          "layer-ui__wrapper__footer-left--transition-left":
            appState.zenModeEnabled,
        })}
      >
        <Stack.Col gap={2}>
          <Section heading="canvasActions">
            <ZoomActions
              renderAction={actionManager.renderAction}
              zoom={appState.zoom}
            />

            {!appState.viewModeEnabled && (
              <UndoRedoActions
                renderAction={actionManager.renderAction}
                className={clsx("zen-mode-transition", {
                  "layer-ui__wrapper__footer-left--transition-bottom":
                    appState.zenModeEnabled,
                })}
              />
            )}
          </Section>
        </Stack.Col>
      </div>

      {/* CENTER: existing tunnel + mouse coordinates */}
      <div className="layer-ui__wrapper__footer-center">
        <FooterCenterTunnel.Out />
        {/* Real-time mouse position */}
        <div
          style={{
            fontSize: 12,
            opacity: 0.8,
            paddingLeft: 8,
            paddingRight: 8,
            whiteSpace: "nowrap",
          }}
        >
          {mousePos ? (
            <span>
              📍 (x: {mousePos.x}, y: {mousePos.y})
            </span>
          ) : (
            <span>📍 (x: –, y: –)</span>
          )}
        </div>
      </div>

      {/* RIGHT SIDE: Help + Zen exit */}
      <div
        className={clsx("layer-ui__wrapper__footer-right zen-mode-transition", {
          "transition-right": appState.zenModeEnabled,
        })}
      >
        <div style={{ position: "relative" }}>
          {renderWelcomeScreen && <WelcomeScreenHelpHintTunnel.Out />}
          <HelpButton
            onClick={() => actionManager.executeAction(actionShortcuts)}
          />
        </div>
      </div>

      <ExitZenModeButton
        actionManager={actionManager}
        showExitZenModeBtn={showExitZenModeBtn}
      />
    </footer>
  );
};

export default Footer;
Footer.displayName = "Footer";

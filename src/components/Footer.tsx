import clsx from "clsx";
import { ActionManager } from "../actions/manager";
import { AppState, ExcalidrawProps } from "../types";
import {
  ExitZenModeAction,
  FinalizeAction,
  UndoRedoActions,
  ZoomActions,
} from "./Actions";
import { useDevice } from "./App";
import { Island } from "./Island";
import { Section } from "./Section";
import Stack from "./Stack";

const Footer = ({
  appState,
  actionManager,
  renderCustomFooter,
  showExitZenModeBtn,
}: {
  appState: AppState;
  actionManager: ActionManager;
  renderCustomFooter?: ExcalidrawProps["renderFooter"];
  showExitZenModeBtn: boolean;
}) => {
  const device = useDevice();
  const showFinalize =
    !appState.viewModeEnabled && appState.multiElement && device.isTouchScreen;
  return (
    <footer
      role="contentinfo"
      className="layer-ui__wrapper__footer App-menu App-menu_bottom"
    >
      <div
        className={clsx("layer-ui__wrapper__footer-left zen-mode-transition", {
          "layer-ui__wrapper__footer-left--transition-left":
            appState.zenModeEnabled,
        })}
      >
        <Stack.Col gap={2}>
          <Section heading="canvasActions">
            <Island padding={1}>
              <ZoomActions
                renderAction={actionManager.renderAction}
                zoom={appState.zoom}
              />
            </Island>
            {!appState.viewModeEnabled && (
              <>
                <UndoRedoActions
                  renderAction={actionManager.renderAction}
                  className={clsx("zen-mode-transition", {
                    "layer-ui__wrapper__footer-left--transition-bottom":
                      appState.zenModeEnabled,
                  })}
                />

                <div
                  className={clsx("eraser-buttons zen-mode-transition", {
                    "layer-ui__wrapper__footer-left--transition-left":
                      appState.zenModeEnabled,
                  })}
                >
                  {actionManager.renderAction("eraser", { size: "small" })}
                </div>
              </>
            )}
            {showFinalize && (
              <FinalizeAction
                renderAction={actionManager.renderAction}
                className={clsx("zen-mode-transition", {
                  "layer-ui__wrapper__footer-left--transition-left":
                    appState.zenModeEnabled,
                })}
              />
            )}
          </Section>
        </Stack.Col>
      </div>
      <div
        className={clsx(
          "layer-ui__wrapper__footer-center zen-mode-transition",
          {
            "layer-ui__wrapper__footer-left--transition-bottom":
              appState.zenModeEnabled,
          },
        )}
      >
        {renderCustomFooter?.(false, appState)}
      </div>
      <ExitZenModeAction
        executeAction={actionManager.executeAction}
        showExitZenModeBtn={showExitZenModeBtn}
      />
    </footer>
  );
};

export default Footer;

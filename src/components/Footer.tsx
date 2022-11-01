import clsx from "clsx";
import { ActionManager } from "../actions/manager";
import { t } from "../i18n";
import { AppState, ExcalidrawProps } from "../types";
import {
  ExitZenModeAction,
  FinalizeAction,
  UndoRedoActions,
  ZoomActions,
} from "./Actions";
import { useDevice } from "./App";
import { WelcomeScreenHelpArrow } from "./icons";
import { Section } from "./Section";
import Stack from "./Stack";
import WelcomeScreenDecor from "./WelcomeScreenDecor";

const Footer = ({
  appState,
  actionManager,
  renderCustomFooter,
  showExitZenModeBtn,
  renderWelcomeScreen,
}: {
  appState: AppState;
  actionManager: ActionManager;
  renderCustomFooter?: ExcalidrawProps["renderFooter"];
  showExitZenModeBtn: boolean;
  renderWelcomeScreen: boolean;
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
      <div
        className={clsx("layer-ui__wrapper__footer-right zen-mode-transition", {
          "transition-right disable-pointerEvents": appState.zenModeEnabled,
        })}
      >
        <div style={{ position: "relative" }}>
          <WelcomeScreenDecor
            shouldRender={renderWelcomeScreen && !appState.isLoading}
          >
            <div className="virgil WelcomeScreen-decor WelcomeScreen-decor--help-pointer">
              <div>{t("welcomeScreen.helpHints")}</div>
              {WelcomeScreenHelpArrow}
            </div>
          </WelcomeScreenDecor>

          {actionManager.renderAction("toggleShortcuts")}
        </div>
      </div>
      <ExitZenModeAction
        actionManager={actionManager}
        showExitZenModeBtn={showExitZenModeBtn}
      />
    </footer>
  );
};

export default Footer;

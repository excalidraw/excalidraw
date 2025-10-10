import { KEYS } from "@excalidraw/common";

import { getNonDeletedElements } from "@excalidraw/element";

import { showSelectedShapeActions } from "@excalidraw/element";

import { CaptureUpdateAction } from "@excalidraw/element";

import { ToolButton } from "../components/ToolButton";
import { HamburgerMenuIcon, HelpIconThin, palette } from "../components/icons";
import { t } from "../i18n";

import { register } from "./register";

export const actionToggleCanvasMenu = register({
  name: "toggleCanvasMenu",
  label: "buttons.menu",
  trackEvent: { category: "menu" },
  perform: (_, appState) => ({
    appState: {
      ...appState,
      openMenu: appState.openMenu === "canvas" ? null : "canvas",
    },
    captureUpdate: CaptureUpdateAction.EVENTUALLY,
  }),
  PanelComponent: ({ appState, updateData }) => (
    <ToolButton
      type="button"
      icon={HamburgerMenuIcon}
      aria-label={t("buttons.menu")}
      onClick={updateData}
      selected={appState.openMenu === "canvas"}
    />
  ),
});

export const actionToggleEditMenu = register({
  name: "toggleEditMenu",
  label: "buttons.edit",
  trackEvent: { category: "menu" },
  perform: (_elements, appState) => ({
    appState: {
      ...appState,
      openMenu: appState.openMenu === "shape" ? null : "shape",
    },
    captureUpdate: CaptureUpdateAction.EVENTUALLY,
  }),
  PanelComponent: ({ elements, appState, updateData }) => (
    <ToolButton
      visible={showSelectedShapeActions(
        appState,
        getNonDeletedElements(elements),
      )}
      type="button"
      icon={palette}
      aria-label={t("buttons.edit")}
      onClick={updateData}
      selected={appState.openMenu === "shape"}
    />
  ),
});

export const actionShortcuts = register({
  name: "toggleShortcuts",
  label: "welcomeScreen.defaults.helpHint",
  icon: HelpIconThin,
  viewMode: true,
  trackEvent: { category: "menu", action: "toggleHelpDialog" },
  perform: (_elements, appState, _, { focusContainer }) => {
    if (appState.openDialog?.name === "help") {
      focusContainer();
    }
    return {
      appState: {
        ...appState,
        openDialog:
          appState.openDialog?.name === "help"
            ? null
            : {
                name: "help",
              },
      },
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
  keyTest: (event) => event.key === KEYS.QUESTION_MARK,
});

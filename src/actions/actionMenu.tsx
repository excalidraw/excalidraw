import { HamburgerMenuIcon, HelpIcon, palette } from "../components/icons";
import { ToolButton } from "../components/ToolButton";
import { t } from "../i18n";
import { showSelectedShapeActions, getNonDeletedElements } from "../element";
import { register } from "./register";
import { allowFullScreen, exitFullScreen, isFullScreen } from "../utils";
import { KEYS } from "../keys";
import { HelpButton } from "../components/HelpButton";
import MenuItem from "../components/MenuItem";

export const actionToggleCanvasMenu = register({
  name: "toggleCanvasMenu",
  trackEvent: { category: "menu" },
  perform: (_, appState) => ({
    appState: {
      ...appState,
      openMenu: appState.openMenu === "canvas" ? null : "canvas",
    },
    commitToHistory: false,
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
  trackEvent: { category: "menu" },
  perform: (_elements, appState) => ({
    appState: {
      ...appState,
      openMenu: appState.openMenu === "shape" ? null : "shape",
    },
    commitToHistory: false,
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

export const actionFullScreen = register({
  name: "toggleFullScreen",
  viewMode: true,
  trackEvent: { category: "canvas", predicate: (appState) => !isFullScreen() },
  perform: () => {
    if (!isFullScreen()) {
      allowFullScreen();
    }
    if (isFullScreen()) {
      exitFullScreen();
    }
    return {
      commitToHistory: false,
    };
  },
  keyTest: (event) => event.key === KEYS.F && !event[KEYS.CTRL_OR_CMD],
});

export const actionShortcuts = register({
  name: "toggleShortcuts",
  viewMode: true,
  trackEvent: { category: "menu", action: "toggleHelpDialog" },
  perform: (_elements, appState, _, { focusContainer }) => {
    if (appState.openDialog === "help") {
      focusContainer();
    }
    return {
      appState: {
        ...appState,
        openDialog: appState.openDialog === "help" ? null : "help",
      },
      commitToHistory: false,
    };
  },
  PanelComponent: ({ updateData, isInHamburgerMenu }) =>
    isInHamburgerMenu ? (
      <MenuItem
        label={t("helpDialog.title")}
        dataTestId="help-menu-item"
        icon={HelpIcon}
        onClick={updateData}
        shortcut="?"
      />
    ) : (
      <HelpButton title={t("helpDialog.title")} onClick={updateData} />
    ),
  keyTest: (event) => event.key === KEYS.QUESTION_MARK,
});

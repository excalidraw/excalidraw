import React from "react";
import { menu, palette } from "../components/icons";
import { ToolButton } from "../components/ToolButton";
import { t } from "../i18n";
import { showSelectedShapeActions, getNonDeletedElements } from "../element";
import { register } from "./register";
import { allowFullScreen, exitFullScreen, isFullScreen } from "../utils";
import { CODES, KEYS } from "../keys";
import { HelpIcon } from "../components/HelpIcon";
import { MiniMap } from "../components/MiniMap";

export const actionToggleCanvasMenu = register({
  name: "toggleCanvasMenu",
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
      icon={menu}
      aria-label={t("buttons.menu")}
      onClick={updateData}
      selected={appState.openMenu === "canvas"}
    />
  ),
});

export const actionToggleEditMenu = register({
  name: "toggleEditMenu",
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
  keyTest: (event) => event.code === CODES.F && !event[KEYS.CTRL_OR_CMD],
});

export const actionShortcuts = register({
  name: "toggleShortcuts",
  perform: (_elements, appState) => {
    return {
      appState: {
        ...appState,
        showHelpDialog: !appState.showHelpDialog,
      },
      commitToHistory: false,
    };
  },
  PanelComponent: ({ updateData }) => (
    <HelpIcon title={t("helpDialog.title")} onClick={updateData} />
  ),
  keyTest: (event) => event.key === KEYS.QUESTION_MARK,
});

export const actionMinimap = register({
  name: "toggleMinimap",
  perform: (_elements, appState) => {
    return {
      appState: {
        ...appState,
        isMinimapEnabled: !appState.isMinimapEnabled,
      },
      commitToHistory: false,
    };
  },
  PanelComponent: ({ appState, elements }) =>
    appState.isMinimapEnabled ? (
      <MiniMap appState={appState} elements={getNonDeletedElements(elements)} />
    ) : null,
  keyTest: (event) => event.key === KEYS.M,
});

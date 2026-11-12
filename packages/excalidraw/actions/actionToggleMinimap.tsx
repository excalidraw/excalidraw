import { CODES, KEYS } from "@excalidraw/common";

import { CaptureUpdateAction } from "@excalidraw/element";

import { IconButton } from "../components/IconButton";
import { MINIMAP_MIN_EDITOR_HEIGHT } from "../components/Minimap/Minimap";
import { Tooltip } from "../components/Tooltip";
import { minimapIcon } from "../components/icons";
import { t } from "../i18n";

import { register } from "./register";
import { getShortcutFromShortcutName } from "./shortcuts";

export const actionToggleMinimap = register({
  name: "minimap",
  label: "labels.minimap",
  icon: minimapIcon,
  keywords: ["map", "overview", "navigator", "navigation"],
  viewMode: true,
  navigation: true,
  trackEvent: {
    category: "canvas",
    predicate: (appState) => !appState.minimapEnabled,
  },
  perform(elements, appState) {
    return {
      appState: {
        ...appState,
        minimapEnabled: !this.checked!(appState),
      },
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
  checked: (appState) => appState.minimapEnabled,
  predicate: (elements, appState, appProps, app) =>
    // the minimap lives in the footer, which isn't rendered on phones
    app.editorInterface.formFactor !== "phone" &&
    appState.height >= MINIMAP_MIN_EDITOR_HEIGHT &&
    app.isNavigationEnabled(),
  keyTest: (event) =>
    !event[KEYS.CTRL_OR_CMD] && event.altKey && event.code === CODES.M,
  PanelComponent: ({ appState, updateData }) => {
    const shortcut = getShortcutFromShortcutName("minimap");
    return (
      <Tooltip label={`${t("labels.minimap")} — ${shortcut}`} delay>
        <IconButton
          type="toggle"
          className="minimap-toggle-button"
          icon={minimapIcon}
          aria-label={t("labels.minimap")}
          aria-keyshortcuts={shortcut}
          checked={appState.minimapEnabled}
          onSelect={() => updateData(null)}
          data-testid="button-minimap"
        />
      </Tooltip>
    );
  },
});

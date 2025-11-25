import { CODES, KEYS } from "@excalidraw/common";
import { CaptureUpdateAction } from "@excalidraw/element";

import { ToolButton } from "../components/ToolButton";
import { t } from "../i18n";
import { getShortcutKey } from "../shortcut";
import { MagicIcon } from "../components/icons"; // Using MagicIcon as placeholder

import { register } from "./register";

export const actionToggleThreeDMode = register({
  name: "threeDMode",
  label: "buttons.threeDMode",
  icon: MagicIcon,
  viewMode: true,
  trackEvent: {
    category: "canvas",
    predicate: (appState) => !appState.threeDModeEnabled,
  },
  perform(elements, appState) {
    return {
      appState: {
        ...appState,
        threeDModeEnabled: !this.checked!(appState),
        // Disable zen mode if entering 3D mode to avoid conflicts, or maybe enable it?
        // Let's just toggle the flag.
      },
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
  checked: (appState) => appState.threeDModeEnabled,
  predicate: (elements, appState, appProps, app) => {
    return (
      app.editorInterface.formFactor !== "phone" &&
      typeof appProps.threeDModeEnabled === "undefined"
    );
  },
  keyTest: (event) =>
    !event[KEYS.CTRL_OR_CMD] && event.altKey && event.code === CODES.D,
  PanelComponent: ({ updateData }) => (
    <ToolButton
      type="button"
      icon={MagicIcon}
      title={`${t("buttons.threeDMode")} — ${getShortcutKey("Alt+D")}`}
      aria-label={t("buttons.threeDMode")}
      onClick={() => updateData(null)}
    />
  ),
});

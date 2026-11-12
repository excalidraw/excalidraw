import { CaptureUpdateAction } from "@excalidraw/element";

import { IconButton } from "../components/IconButton";
import { MINIMAP_MIN_EDITOR_HEIGHT } from "../components/Minimap/Minimap";
import { MinimapAnnouncementDot } from "../components/Minimap/MinimapAnnouncementDot";
import { Tooltip, hideTooltip } from "../components/Tooltip";
import { minimapIcon } from "../components/icons";
import { t } from "../i18n";

import { register } from "./register";

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
  PanelComponent: ({ appState, updateData, app }) => {
    return (
      <>
        <Tooltip label={t("labels.minimap")} delay>
          <IconButton
            type="toggle"
            className="minimap-toggle-button"
            icon={minimapIcon}
            aria-label={t("labels.minimap")}
            checked={appState.minimapEnabled}
            onSelect={() => {
              // the tooltip would cover the minimap being opened
              if (!appState.minimapEnabled) {
                hideTooltip();
              }
              updateData(null);
            }}
            data-testid="button-minimap"
          />
        </Tooltip>
        <MinimapAnnouncementDot
          app={app}
          minimapEnabled={appState.minimapEnabled}
        />
      </>
    );
  },
});

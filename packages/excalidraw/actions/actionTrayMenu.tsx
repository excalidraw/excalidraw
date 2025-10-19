import { getNonDeletedElements } from "@excalidraw/element";

import { showSelectedShapeActions } from "@excalidraw/element";

import { CaptureUpdateAction } from "@excalidraw/element";

import { ToolButton } from "../components/ToolButton";
import { palette } from "../components/icons";
import { t } from "../i18n";

import { register } from "./register";

export const actionToggleTrayEditMenu = register({
  name: "toggleTrayEditMenu",
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

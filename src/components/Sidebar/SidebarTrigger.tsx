import { trackEvent } from "../../analytics";
import { t } from "../../i18n";
import { capitalizeString } from "../../utils";
import {
  useDevice,
  useExcalidrawSetAppState,
  useExcalidrawAppState,
} from "../App";
import { LIBRARY_SIDEBAR } from "../../constants";
import { SidebarTriggerProps } from "./common";

import "./SidebarTrigger.scss";

export const SidebarTrigger = ({ icon, children }: SidebarTriggerProps) => {
  const device = useDevice();
  const setAppState = useExcalidrawSetAppState();
  // TODO replace with sidebar context
  const appState = useExcalidrawAppState();

  // TODO barnabasmolnar/redesign
  // not great, toolbar jumps in a jarring manner
  if (
    appState.isSidebarDocked &&
    appState.openSidebar?.name === LIBRARY_SIDEBAR.name
  ) {
    return null;
  }

  return (
    <label title={`${capitalizeString(t("toolBar.library"))}`}>
      <input
        className="ToolIcon_type_checkbox"
        type="checkbox"
        name="editor-library"
        onChange={(event) => {
          document
            .querySelector(".layer-ui__wrapper")
            ?.classList.remove("animate");
          const isOpen = event.target.checked;
          setAppState({ openSidebar: isOpen ? LIBRARY_SIDEBAR : null });
          // track only openings
          if (isOpen) {
            trackEvent(
              "sidebar",
              `toggle-tab:${LIBRARY_SIDEBAR.tab} (open)`,
              `toolbar (${device.isMobile ? "mobile" : "desktop"})`,
            );
          }
        }}
        checked={appState.openSidebar?.name === LIBRARY_SIDEBAR.name}
        aria-label={capitalizeString(t("toolBar.library"))}
        aria-keyshortcuts="0"
      />
      <div className="sidebar-trigger">
        {icon && <div>{icon}</div>}
        {!device.isMobile && (
          <div className="library-button__label">{children}</div>
        )}
      </div>
    </label>
  );
};

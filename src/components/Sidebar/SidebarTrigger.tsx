import { trackEvent } from "../../analytics";
import { t } from "../../i18n";
import { capitalizeString } from "../../utils";
import {
  useDevice,
  useExcalidrawSetAppState,
  useExcalidrawAppState,
} from "../App";
import { DEFAULT_SIDEBAR, LIBRARY_SIDEBAR_TAB } from "../../constants";
import { SidebarTriggerProps } from "./common";

import "./SidebarTrigger.scss";
import { useAtomValue } from "jotai";
import { isSidebarDockedAtom } from "./Sidebar";
import { jotaiScope } from "../../jotai";

export const SidebarTrigger = ({ icon, children }: SidebarTriggerProps) => {
  const device = useDevice();
  const setAppState = useExcalidrawSetAppState();
  // TODO replace with sidebar context
  const appState = useExcalidrawAppState();
  const isSidebarDocked = useAtomValue(isSidebarDockedAtom, jotaiScope);

  // TODO barnabasmolnar/redesign
  // not great, toolbar jumps in a jarring manner
  if (isSidebarDocked && appState.openSidebar?.name === DEFAULT_SIDEBAR.name) {
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
          setAppState({
            openSidebar: isOpen ? { name: DEFAULT_SIDEBAR.name } : null,
          });
          // track only openings
          if (isOpen) {
            trackEvent(
              "sidebar",
              `toggle-tab:${LIBRARY_SIDEBAR_TAB} (open)`,
              `toolbar (${device.isMobile ? "mobile" : "desktop"})`,
            );
          }
        }}
        checked={appState.openSidebar?.name === DEFAULT_SIDEBAR.name}
        aria-label={capitalizeString(t("toolBar.library"))}
        aria-keyshortcuts="0"
      />
      <div className="sidebar-trigger">
        {icon && <div>{icon}</div>}
        {!device.isMobile && children && (
          <div className="library-button__label">{children}</div>
        )}
      </div>
    </label>
  );
};

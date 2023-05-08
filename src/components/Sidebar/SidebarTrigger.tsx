import { useExcalidrawSetAppState } from "../App";
import { SidebarTriggerProps } from "./common";
import { useUIAppState } from "../../context/ui-appState";
import clsx from "clsx";

import "./SidebarTrigger.scss";

export const SidebarTrigger = ({
  name,
  tab,
  icon,
  title,
  children,
  onToggle,
  className,
  style,
}: SidebarTriggerProps) => {
  const setAppState = useExcalidrawSetAppState();
  const appState = useUIAppState();

  return (
    <label title={title}>
      <input
        className="ToolIcon_type_checkbox"
        type="checkbox"
        onChange={(event) => {
          document
            .querySelector(".layer-ui__wrapper")
            ?.classList.remove("animate");
          const isOpen = event.target.checked;
          setAppState({ openSidebar: isOpen ? { name, tab } : null });
          onToggle?.(isOpen);
        }}
        checked={appState.openSidebar?.name === name}
        aria-label={title}
        aria-keyshortcuts="0"
      />
      <div className={clsx("sidebar-trigger", className)} style={style}>
        {icon && <div>{icon}</div>}
        {children && <div className="sidebar-trigger__label">{children}</div>}
      </div>
    </label>
  );
};
SidebarTrigger.displayName = "SidebarTrigger";

import clsx from "clsx";

import { useUIAppState } from "../../context/ui-appState";
import { useExcalidrawSetAppState } from "../App";

import "./SidebarTrigger.scss";

import type { SidebarTriggerProps } from "./common";

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

  const isOpen = appState.openSidebar?.name === name;

  return (
    <button
      type="button"
      title={title}
      className="sidebar-trigger__label-element"
      aria-label={title}
      aria-keyshortcuts="0"
      aria-pressed={isOpen}
      onClick={() => {
        document
          .querySelector(".layer-ui__wrapper")
          ?.classList.remove("animate");
        const nextOpen = !isOpen;
        setAppState({
          openSidebar: nextOpen ? { name, tab } : null,
          openMenu: null,
          openPopup: null,
        });
        onToggle?.(nextOpen);
      }}
    >
      <div className={clsx("sidebar-trigger", className)} style={style}>
        {icon && <div>{icon}</div>}
        {children && <div className="sidebar-trigger__label">{children}</div>}
      </div>
    </button>
  );
};
SidebarTrigger.displayName = "SidebarTrigger";

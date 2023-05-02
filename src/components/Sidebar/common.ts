import React from "react";
import { AppState, SidebarName, SidebarTab } from "../../types";

export type SidebarTriggerProps = {
  name: SidebarName;
  tab?: SidebarTab;
  icon?: JSX.Element;
  children?: React.ReactNode;
  title?: string;
  className?: string;
  onToggle?: (open: boolean) => void;
};

export type SidebarProps<P = {}> = {
  name: SidebarName;
  children: React.ReactNode;
  onStateChange?: (openSidebar: AppState["openSidebar"]) => void;
  /**
   * Called on sidebar close (either by user action or by the editor).
   */
  onToggle?: (open: boolean) => void;
  /** if not supplied, sidebar won't be dockable */
  onDock?: (docked: boolean) => void;
  docked?: boolean;
  dockable?: boolean;
  className?: string;
  // NOTE sidebars we use internally inside the editor must have this flag set.
  // It indicates that this sidebar should have lower precedence over host
  // sidebars, if both are open.
  /** @private internal */
  __fallback?: boolean;
} & P;

export type SidebarPropsContextValue = Pick<
  SidebarProps,
  "onDock" | "docked" | "dockable"
> & { onCloseRequest: () => void };

export const SidebarPropsContext =
  React.createContext<SidebarPropsContextValue>({} as SidebarPropsContextValue);

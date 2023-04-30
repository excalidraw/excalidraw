import React from "react";

export type SidebarName = string;

export type SidebarTriggerProps = {
  icon?: JSX.Element;
  children: React.ReactNode;
};

export type SidebarProps<P = {}> = {
  name: string;
  children: React.ReactNode;
  /**
   * Called on sidebar close (either by user action or by the editor).
   */
  onClose?: () => void | boolean;
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
  "onClose" | "onDock" | "docked" | "dockable"
>;

export const SidebarPropsContext =
  React.createContext<SidebarPropsContextValue>({} as SidebarPropsContextValue);

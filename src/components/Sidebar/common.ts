import React from "react";

export type SidebarProps<P = {}> = {
  children: React.ReactNode;
  /**
   * Called on sidebar close (either by user action or by the editor).
   */
  onClose?: () => void | boolean;
  /** if not supplied, sidebar won't be dockable */
  onDock?: (docked: boolean) => void;
  docked?: boolean;
  initialDockedState?: boolean;
  dockable?: boolean;
  className?: string;
} & P;

export type SidebarPropsContextValue = Pick<
  SidebarProps,
  "onClose" | "onDock" | "docked" | "dockable"
>;

export const SidebarPropsContext =
  React.createContext<SidebarPropsContextValue>({});

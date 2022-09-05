import React from "react";

export type SidebarProps<P = {}> = {
  children: React.ReactNode;
  /** if not supplied, sidebar won't be closable */
  onClose?: () => void;
  /** if not supplied, sidebar won't be dockable */
  onDock?: (docked: boolean) => void;
  docked?: boolean;
} & P;

export type SidebarPropsContextValue = Pick<
  SidebarProps,
  "onClose" | "onDock" | "docked"
>;

export const SidebarPropsContext =
  React.createContext<SidebarPropsContextValue>({});

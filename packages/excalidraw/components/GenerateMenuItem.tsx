import { useTunnels } from "../context/tunnels";

import DropdownMenu from "./dropdownMenu/DropdownMenu";

import type { JSX, ReactNode } from "react";

export type GenerateMenuItemProps = {
  /**
   * Called when the host's menu item is selected. Hosts are expected to
   * open their own modal / trigger their own workflow here — Excalidraw
   * does not perform any action of its own.
   */
  onSelect: (event: Event) => void;
  /** Icon shown to the left of the label. */
  icon?: JSX.Element;
  /** Optional keyboard shortcut hint (right-aligned in the row). */
  shortcut?: string;
  /** Optional badge (e.g. "AI"). */
  badge?: ReactNode;
  /** The label rendered inside the menu item. */
  children: ReactNode;
  /** Extra props forwarded to the underlying button (e.g. `data-testid`). */
  className?: string;
  "data-testid"?: string;
};

/**
 * Host-defined entry in the "Generate" section of the extra-tools dropdown.
 *
 * Mirrors the tunnel-rat pattern used by <TTDDialogTrigger>, but the host
 * owns the `onSelect` handler — Excalidraw does not open any built-in
 * dialog. Use this to expose custom "generate content on the canvas"
 * workflows (e.g. inserting data from a third-party integration).
 *
 * Multiple <GenerateMenuItem>s may be rendered; each becomes its own row.
 */
export const GenerateMenuItem = ({
  onSelect,
  icon,
  shortcut,
  badge,
  children,
  className,
  ...rest
}: GenerateMenuItemProps) => {
  const { GenerateMenuItemTunnel } = useTunnels();

  return (
    <GenerateMenuItemTunnel.In>
      <DropdownMenu.Item
        onSelect={onSelect}
        icon={icon}
        shortcut={shortcut}
        badge={badge}
        className={className}
        {...rest}
      >
        {children}
      </DropdownMenu.Item>
    </GenerateMenuItemTunnel.In>
  );
};
GenerateMenuItem.displayName = "GenerateMenuItem";

import { ContextMenu } from "radix-ui";

import { useExcalidrawContainer } from "../App";

import type { ReactElement } from "react";

/**
 * right-click context menu of a customizable top-picks strip, resetting it
 * to its default picks. Renders the strip as-is when not customizable.
 */
export const TopPicksContextMenu = ({
  children,
  onReset,
  isCustomized,
  resetLabel,
}: {
  /** the strip (must accept a ref — used as the menu trigger) */
  children: ReactElement;
  /** present when the strip is user-customizable */
  onReset?: () => void;
  /** whether custom picks are currently applied (enables the reset item) */
  isCustomized: boolean;
  resetLabel: string;
}) => {
  const { container } = useExcalidrawContainer();

  if (!onReset) {
    return children;
  }

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>{children}</ContextMenu.Trigger>
      <ContextMenu.Portal container={container}>
        <ContextMenu.Content
          className="top-picks-dnd__context-menu"
          style={{ zIndex: "var(--zIndex-ui-styles-popup)" }}
        >
          <ContextMenu.Item
            className="top-picks-dnd__context-menu-item"
            disabled={!isCustomized}
            onSelect={onReset}
          >
            {resetLabel}
          </ContextMenu.Item>
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
};

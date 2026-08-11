import React, { useLayoutEffect, useState } from "react";

type RadixPortalComponent = React.ComponentType<
  React.PropsWithChildren<{
    container?: HTMLElement;
  }>
>;

type ObsidianRadixPortalProps = {
  children: React.ReactNode;
  container: HTMLDivElement | null;
  portal: RadixPortalComponent;
};

type BridgeStyle = React.CSSProperties &
  Record<string, string | number | undefined>;

const readBridgeStyle = (container: HTMLDivElement | null): BridgeStyle => {
  const style: BridgeStyle = { display: "contents" };
  if (container) {
    Array.from(container.style).forEach((propertyName) => {
      if (propertyName === "color" || propertyName.startsWith("--")) {
        style[propertyName] = container.style.getPropertyValue(propertyName);
      }
    });
  }
  return style;
};

const isSameBridgeStyle = (a: BridgeStyle, b: BridgeStyle) => {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  return (
    aKeys.length === bKeys.length &&
    aKeys.every((key) => a[key] === b[key])
  );
};

/**
 * Purpose:
 *   Render Radix floating-position wrappers directly under the owning
 *   document's body. Obsidian popout windows place Excalidraw inside an
 *   offset containing block, which otherwise displaces Radix's fixed wrapper.
 *   The display:contents bridge retains Excalidraw's scoped theme rules and
 *   inline CSS variables without creating another containing block.
 *
 * Author:
 *   zsviczian
 *
 * References:
 *   https://github.com/excalidraw/excalidraw/pull/10221
 *
 * Notes:
 *   This is specific to Excalidraw hosted in Obsidian's Electron popouts.
 *   The bridge style is re-synced in a `useLayoutEffect` rather than read
 *   inline during render: render always observes the *previous* commit's
 *   `container.style` (React hasn't flushed this render's DOM writes yet),
 *   so a style that changes while the portal is already open — e.g. dynamic
 *   canvas-color theming while its color-picker popover is open — was
 *   captured one commit stale and stuck that way until the popover was
 *   closed and reopened (a fresh mount reads current DOM state). The
 *   `useLayoutEffect` runs after the commit, so it observes the live value;
 *   the shallow-equality check keeps it from looping once synced.
 */
export const ObsidianRadixPortal = ({
  children,
  container,
  portal: Portal,
}: ObsidianRadixPortalProps) => {
  const [bridgeStyle, setBridgeStyle] = useState(() =>
    readBridgeStyle(container),
  );

  useLayoutEffect(() => {
    const next = readBridgeStyle(container);
    setBridgeStyle((prev) => (isSameBridgeStyle(prev, next) ? prev : next));
  });

  return (
    <Portal container={container?.ownerDocument.body}>
      <div
        className={container?.className}
        style={bridgeStyle}
        data-radix-portal // zsviczian -- keep body-portaled UI inside sidebar outside-click handling
      >
        {children}
      </div>
    </Portal>
  );
};

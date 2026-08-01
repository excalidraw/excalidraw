import React from "react";

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
 */
export const ObsidianRadixPortal = ({
  children,
  container,
  portal: Portal,
}: ObsidianRadixPortalProps) => {
  const bridgeStyle = {
    display: "contents",
  } as React.CSSProperties & Record<string, string | number | undefined>;

  if (container) {
    Array.from(container.style).forEach((propertyName) => {
      if (propertyName === "color" || propertyName.startsWith("--")) {
        bridgeStyle[propertyName] =
          container.style.getPropertyValue(propertyName);
      }
    });
  }

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

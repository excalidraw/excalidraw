import * as Popover from "@radix-ui/react-popover";
import clsx from "clsx";
import React, { type ReactNode } from "react";

import { isInteractive } from "@excalidraw/common";

import { useDevice } from "./App";
import { Island } from "./Island";

interface PropertiesPopoverProps {
  className?: string;
  container: HTMLDivElement | null;
  children: ReactNode;
  style?: object;
  onClose: () => void;
  onKeyDown?: React.KeyboardEventHandler<HTMLDivElement>;
  onPointerLeave?: React.PointerEventHandler<HTMLDivElement>;
  onFocusOutside?: Popover.PopoverContentProps["onFocusOutside"];
  onPointerDownOutside?: Popover.PopoverContentProps["onPointerDownOutside"];
  preventAutoFocusOnTouch?: boolean;
}

export const PropertiesPopover = React.forwardRef<
  HTMLDivElement,
  PropertiesPopoverProps
>(
  (
    {
      className,
      container,
      children,
      style,
      onClose,
      onKeyDown,
      onFocusOutside,
      onPointerLeave,
      onPointerDownOutside,
      preventAutoFocusOnTouch = false,
    },
    ref,
  ) => {
    const device = useDevice();

    return (
      <Popover.Portal container={container}>
        <Popover.Content
          ref={ref}
          className={clsx("focus-visible-none", className)}
          data-prevent-outside-click
          side={
            device.editor.isMobile && !device.viewport.isLandscape
              ? "bottom"
              : "right"
          }
          align={
            device.editor.isMobile && !device.viewport.isLandscape
              ? "center"
              : "start"
          }
          alignOffset={-16}
          sideOffset={20}
          style={{
            zIndex: "var(--zIndex-ui-styles-popup)",
            marginLeft: device.editor.isMobile ? "0.5rem" : undefined,
          }}
          onPointerLeave={onPointerLeave}
          onKeyDown={onKeyDown}
          onFocusOutside={onFocusOutside}
          onPointerDownOutside={onPointerDownOutside}
          onOpenAutoFocus={(e) => {
            // prevent auto-focus on touch devices to avoid keyboard popup
            if (preventAutoFocusOnTouch && device.isTouchScreen) {
              e.preventDefault();
            }
          }}
          onCloseAutoFocus={(e) => {
            e.stopPropagation();
            // prevents focusing the trigger
            e.preventDefault();

            // return focus to excalidraw container unless
            // user focuses an interactive element, such as a button, or
            // enters the text editor by clicking on canvas with the text tool
            if (container && !isInteractive(document.activeElement)) {
              container.focus();
            }

            onClose();
          }}
        >
          <Island padding={3} style={style}>
            {children}
          </Island>
          <Popover.Arrow
            width={20}
            height={10}
            style={{
              fill: "var(--popup-bg-color)",
              filter: "drop-shadow(rgba(0, 0, 0, 0.05) 0px 3px 2px)",
            }}
          />
        </Popover.Content>
      </Popover.Portal>
    );
  },
);

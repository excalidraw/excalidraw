import React, { useLayoutEffect, useRef, useEffect } from "react";
import "./Popover.scss";
import { unstable_batchedUpdates } from "react-dom";

type Props = {
  top?: number;
  left?: number;
  children?: React.ReactNode;
  onCloseRequest?(event: PointerEvent): void;
  fitInViewport?: boolean;
  viewportWidth?: number;
  viewportHeight?: number;
};

export const Popover = ({
  children,
  left,
  top,
  onCloseRequest,
  fitInViewport = false,
  viewportWidth = window.innerWidth,
  viewportHeight = window.innerHeight,
}: Props) => {
  const popoverRef = useRef<HTMLDivElement>(null);

  // ensure the popover doesn't overflow the viewport
  useLayoutEffect(() => {
    if (fitInViewport && popoverRef.current) {
      const element = popoverRef.current;
      const { x, y, width, height } = element.getBoundingClientRect();
      if (x + width > viewportWidth) {
        element.style.left = `${viewportWidth - width}px`;
      }
      if (y + height > viewportHeight) {
        element.style.top = `${viewportHeight - height}px`;
      }
    }
  }, [fitInViewport, viewportWidth, viewportHeight]);

  useEffect(() => {
    if (onCloseRequest) {
      const handler = (event: PointerEvent) => {
        if (!popoverRef.current?.contains(event.target as Node)) {
          unstable_batchedUpdates(() => onCloseRequest(event));
        }
      };
      document.addEventListener("pointerdown", handler, false);
      return () => document.removeEventListener("pointerdown", handler, false);
    }
  }, [onCloseRequest]);

  return (
    <div className="popover" style={{ top, left }} ref={popoverRef}>
      {children}
    </div>
  );
};

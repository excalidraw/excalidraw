import React, { useLayoutEffect, useRef, useEffect } from "react";
import "./Popover.css";
import { unstable_batchedUpdates } from "react-dom";

type Props = {
  top?: number;
  left?: number;
  children?: React.ReactNode;
  onCloseRequest?(): void;
  fitInViewport?: boolean;
};

export function Popover({
  children,
  left,
  top,
  onCloseRequest,
  fitInViewport = false,
}: Props) {
  const popoverRef = useRef<HTMLDivElement>(null);

  // ensure the popover doesn't overflow the viewport
  useLayoutEffect(() => {
    if (fitInViewport && popoverRef.current) {
      const element = popoverRef.current;
      const { x, y, width, height } = element.getBoundingClientRect();

      const viewportWidth = window.innerWidth;
      if (x + width > viewportWidth) {
        element.style.left = `${viewportWidth - width}px`;
      }
      const viewportHeight = window.innerHeight;
      if (y + height > viewportHeight) {
        element.style.top = `${viewportHeight - height}px`;
      }
    }
  }, [fitInViewport]);

  useEffect(() => {
    if (onCloseRequest) {
      const handler = (e: Event) => {
        if (!popoverRef.current?.contains(e.target as Node)) {
          unstable_batchedUpdates(() => onCloseRequest());
        }
      };
      document.addEventListener("pointerdown", handler, false);
      return () => document.removeEventListener("pointerdown", handler, false);
    }
  }, [onCloseRequest]);

  return (
    <div className="popover" style={{ top: top, left: left }} ref={popoverRef}>
      {children}
    </div>
  );
}

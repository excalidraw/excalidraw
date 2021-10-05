import React, { useLayoutEffect, useRef, useEffect } from "react";
import "./Popover.scss";
import { unstable_batchedUpdates } from "react-dom";

type Props = {
  top?: number;
  left?: number;
  children?: React.ReactNode;
  onCloseRequest?(event: PointerEvent): void;
  fitInViewport?: boolean;
};

export const Popover = ({
  children,
  left,
  top,
  onCloseRequest,
  fitInViewport = false,
}: Props) => {
  const popoverRef = useRef<HTMLDivElement>(null);

  // ensure the popover doesn't overflow the viewport
  useLayoutEffect(() => {
    if (fitInViewport && popoverRef.current) {
      const element = popoverRef.current;
      const { x, y, width, height } = element.getBoundingClientRect();
      const { innerWidth: viewportWidth, innerHeight: viewportHeight } = window;

      //Resize to fit viewport on smaller screens
      if (height >= viewportHeight) {
        element.style.height = `${viewportHeight}px`;
        element.style.top = "0px";
        element.style.overflowY = "scroll";
      }
      if (width >= viewportWidth) {
        element.style.width = `${viewportWidth}px`;
        element.style.left = "0px";
        element.style.overflowX = "scroll";
      }
      //Position correctly when clicked on rightmost part or the bottom part of viewport
      if (x + width > viewportWidth && width < viewportWidth) {
        element.style.left = `${viewportWidth - width}px`;
      }
      if (y + height > viewportHeight && height < viewportHeight) {
        element.style.top = `${viewportHeight - height}px`;
      }
    }
  }, [fitInViewport]);

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

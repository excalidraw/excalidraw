import React, { useLayoutEffect, useRef, useEffect } from "react";
import "./Popover.scss";
import { unstable_batchedUpdates } from "react-dom";
import { queryFocusableElements } from "../utils";
import { KEYS } from "../keys";

type Props = {
  top?: number;
  left?: number;
  children?: React.ReactNode;
  onCloseRequest?(event: PointerEvent): void;
  fitInViewport?: boolean;
  offsetLeft?: number;
  offsetTop?: number;
  viewportWidth?: number;
  viewportHeight?: number;
};

export const Popover = ({
  children,
  left,
  top,
  onCloseRequest,
  fitInViewport = false,
  offsetLeft = 0,
  offsetTop = 0,
  viewportWidth = window.innerWidth,
  viewportHeight = window.innerHeight,
}: Props) => {
  const popoverRef = useRef<HTMLDivElement>(null);

  const container = popoverRef.current;

  useEffect(() => {
    if (!container) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === KEYS.TAB) {
        const focusableElements = queryFocusableElements(container);
        const { activeElement } = document;
        const currentIndex = focusableElements.findIndex(
          (element) => element === activeElement,
        );

        if (currentIndex === 0 && event.shiftKey) {
          focusableElements[focusableElements.length - 1].focus();
          event.preventDefault();
          event.stopImmediatePropagation();
        } else if (
          currentIndex === focusableElements.length - 1 &&
          !event.shiftKey
        ) {
          focusableElements[0].focus();
          event.preventDefault();
          event.stopImmediatePropagation();
        }
      }
    };

    container.addEventListener("keydown", handleKeyDown);

    return () => container.removeEventListener("keydown", handleKeyDown);
  }, [container]);

  // ensure the popover doesn't overflow the viewport
  useLayoutEffect(() => {
    if (fitInViewport && popoverRef.current) {
      const element = popoverRef.current;
      const { x, y, width, height } = element.getBoundingClientRect();

      //Position correctly when clicked on rightmost part or the bottom part of viewport
      if (x + width - offsetLeft > viewportWidth) {
        element.style.left = `${viewportWidth - width - 10}px`;
      }
      if (y + height - offsetTop > viewportHeight) {
        element.style.top = `${viewportHeight - height}px`;
      }

      //Resize to fit viewport on smaller screens
      if (height >= viewportHeight) {
        element.style.height = `${viewportHeight - 20}px`;
        element.style.top = "10px";
        element.style.overflowY = "scroll";
      }
      if (width >= viewportWidth) {
        element.style.width = `${viewportWidth}px`;
        element.style.left = "0px";
        element.style.overflowX = "scroll";
      }
    }
  }, [fitInViewport, viewportWidth, viewportHeight, offsetLeft, offsetTop]);

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

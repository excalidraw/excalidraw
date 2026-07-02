import React from "react";
import clsx from "clsx";

import "./Island.scss";

import type { ViewportUIDock } from "../types";

type IslandProps = {
  children: React.ReactNode;
  padding?: number;
  className?: string | boolean;
  style?: object;
  /** marks the island as a canvas-occluding UI surface measured by
   * `getViewportOffsets` (see {@link ViewportUIDock}) */
  "data-viewport-ui"?: ViewportUIDock;
};

export const Island = React.forwardRef<HTMLDivElement, IslandProps>(
  (
    { children, padding, className, style, "data-viewport-ui": viewportUI },
    ref,
  ) => (
    <div
      className={clsx("Island", className)}
      style={{ "--padding": padding, ...style }}
      data-viewport-ui={viewportUI}
      ref={ref}
    >
      {children}
    </div>
  ),
);

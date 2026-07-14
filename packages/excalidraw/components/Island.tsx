import React from "react";
import clsx from "clsx";

import "./Island.scss";

import type { ViewportUIDock, ViewportUIName } from "../types";

type IslandProps = {
  children: React.ReactNode;
  padding?: number;
  className?: string | boolean;
  style?: object;
  role?: React.AriaRole;
  "aria-label"?: string;
  /** marks the island as a canvas-occluding UI surface measured by
   * `getViewportOffsets` (see {@link ViewportUIDock}) */
  "data-viewport-ui"?: ViewportUIDock;
  /** identifies the surface so `getViewportOffsets` can reserve space for
   * it while hidden (see {@link ViewportUIName}) */
  "data-viewport-ui-name"?: ViewportUIName;
};

export const Island = React.forwardRef<HTMLDivElement, IslandProps>(
  (
    {
      children,
      padding,
      className,
      style,
      role,
      "aria-label": ariaLabel,
      "data-viewport-ui": viewportUI,
      "data-viewport-ui-name": viewportUIName,
    },
    ref,
  ) => (
    <div
      className={clsx("Island", className)}
      style={{ "--padding": padding, ...style }}
      role={role}
      aria-label={ariaLabel}
      data-viewport-ui={viewportUI}
      data-viewport-ui-name={viewportUIName}
      ref={ref}
    >
      {children}
    </div>
  ),
);

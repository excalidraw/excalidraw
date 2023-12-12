import "./Island.scss";

import React from "react";
import clsx from "clsx";

type IslandProps = {
  children: React.ReactNode;
  padding?: number;
  className?: string | boolean;
  style?: object;
};

export const Island = React.forwardRef<HTMLDivElement, IslandProps>(
  ({ children, padding, className, style }, ref) => (
    <div
      className={clsx("Island", className)}
      style={{ "--padding": padding, ...style }}
      ref={ref}
    >
      {children}
    </div>
  ),
);

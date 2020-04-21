import "./Island.scss";

import React from "react";

type IslandProps = {
  children: React.ReactNode;
  padding?: number;
  className?: string | boolean;
  style?: object;
};

export const Island = React.forwardRef<HTMLDivElement, IslandProps>(
  ({ children, padding, className, style }, ref) => (
    <div
      className={`${className ?? ""} Island`}
      style={{ "--padding": padding, ...style } as React.CSSProperties}
      ref={ref}
    >
      {children}
    </div>
  ),
);

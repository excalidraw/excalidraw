import "./Island.css";

import React from "react";

type IslandProps = {
  children: React.ReactNode;
  padding?: number;
  className?: string;
};

export const Island = React.forwardRef<HTMLDivElement, IslandProps>(
  ({ children, padding, className }, ref) => (
    <div
      className={`${className ?? ""} Island`}
      style={{ "--padding": padding } as React.CSSProperties}
      ref={ref}
    >
      {children}
    </div>
  ),
);

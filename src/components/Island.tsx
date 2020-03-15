import "./Island.css";

import React from "react";

type IslandProps = { children: React.ReactNode; padding?: number };

export const Island = React.forwardRef<HTMLDivElement, IslandProps>(
  ({ children, padding }, ref) => (
    <div
      className="Island"
      style={{ "--padding": padding } as React.CSSProperties}
      ref={ref}
    >
      {children}
    </div>
  ),
);

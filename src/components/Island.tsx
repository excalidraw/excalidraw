import "./Island.css";

import React from "react";

type IslandProps = { children: React.ReactNode; padding?: number };

export function Island({ children, padding }: IslandProps) {
  return (
    <div
      className="Island"
      style={{ "--padding": padding } as React.CSSProperties}
    >
      {children}
    </div>
  );
}

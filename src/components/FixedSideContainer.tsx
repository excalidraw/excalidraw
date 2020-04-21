import "./FixedSideContainer.css";

import React from "react";

type FixedSideContainerProps = {
  children: React.ReactNode;
  side: "top" | "left" | "right";
  className?: string;
};

export function FixedSideContainer({
  children,
  side,
  className,
}: FixedSideContainerProps) {
  return (
    <div
      className={`FixedSideContainer FixedSideContainer_side_${side} ${className}`}
    >
      {children}
    </div>
  );
}

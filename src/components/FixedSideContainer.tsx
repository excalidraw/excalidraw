import "./FixedSideContainer.css";

import React from "react";

type FixedSideContainerProps = {
  children: React.ReactNode;
  side: "top" | "left" | "right";
};

export const FixedSideContainer = ({
  children,
  side,
}: FixedSideContainerProps) => (
  <div className={`FixedSideContainer FixedSideContainer_side_${side}`}>
    {children}
  </div>
);

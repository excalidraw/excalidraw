import React from "react";
import clsx from "clsx";

import "./FixedSideContainer.scss";

type FixedSideContainerProps = {
  children: React.ReactNode;
  side: "top" | "left" | "right";
  className?: string;
  sidepanelOpen?: boolean; //zsviczian
};

export const FixedSideContainer = ({
  children,
  side,
  className,
  sidepanelOpen = false, //zsviczian
}: FixedSideContainerProps) => (
  <div
    style={sidepanelOpen ? { right: "var(--right-sidebar-width)" } : undefined} //zsviczian
    className={clsx(
      "FixedSideContainer",
      `FixedSideContainer_side_${side}`,
      className,
    )}
  >
    {children}
  </div>
);

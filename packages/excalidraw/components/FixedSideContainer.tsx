import "./FixedSideContainer.scss";

import React from "react";
import clsx from "clsx";
import { getUiMode } from "../utils";

type FixedSideContainerProps = {
  children: React.ReactNode;
  side: "top" | "left" | "right";
  className?: string;
};

export const FixedSideContainer = ({
  children,
  side,
  className,
}: FixedSideContainerProps) => {
  const uiMode = getUiMode();
  return (
    <div
      className={clsx(
        "FixedSideContainer",
        `FixedSideContainer_side_${side}`,
        className,
        { "ui-mode-all": uiMode === "all" },
      )}
    >
      {children}
    </div>
  );
};

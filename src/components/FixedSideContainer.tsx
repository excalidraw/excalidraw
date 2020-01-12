import "./FixedSideContainer.css";

import React from "react";

type FixedSideContainerProps = {
  children: React.ReactNode;
  side: "top" | "left";
};

export function FixedSideContainer({
  children,
  side
}: FixedSideContainerProps) {
  return (
    <div className={"FixedSideContainer FixedSideContainer_side_" + side}>
      {children}
    </div>
  );
}

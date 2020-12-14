import "./Tooltip.scss";

import React from "react";

type TooltipProps = {
  children: React.ReactNode;
  label: string;
  position?: "above" | "below";
  long?: boolean;
};

export const Tooltip = ({
  children,
  label,
  position = "below",
  long = false,
}: TooltipProps) => (
  <div className="Tooltip">
    <span
      className={
        position === "above"
          ? "Tooltip__label Tooltip__label--above"
          : "Tooltip__label Tooltip__label--below"
      }
      style={{ width: long ? "50ch" : "10ch" }}
    >
      {label}
    </span>
    {children}
  </div>
);

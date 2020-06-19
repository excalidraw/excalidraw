import "./Tooltip.scss";

import React from "react";

type TooltipProps = {
  children: React.ReactNode;
  label: string;
};

export const Tooltip = ({ children, label }: TooltipProps) => (
  <div className="Tooltip">
    <span className="Tooltip__label">{label}</span>
    {children}
  </div>
);

import React from "react";

type HelpIconProps = {
  title?: string;
  name?: string;
  id?: string;
  onClick?(): void;
};

const ICON = (
  <svg width={24} height={24} fill="none">
    <path
      d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"
      stroke="#000"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3M12 17h.01"
      stroke="#000"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const HelpIcon = (props: HelpIconProps) => (
  <label title={`${props.title} — ?`} className="help-icon">
    <div onClick={props.onClick}>{ICON}</div>
  </label>
);

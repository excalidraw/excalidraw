import "./ToolIcon.scss";

import React from "react";

type LockIconSize = "s" | "m";

type LockIconProps = {
  title?: string;
  name?: string;
  id?: string;
  checked: boolean;
  onChange?(): void;
  size?: LockIconSize;
  zenModeEnabled?: boolean;
};

const DEFAULT_SIZE: LockIconSize = "m";

const ICONS = {
  CHECKED: (
    <svg width={24} height={24}>
      <path
        d="M19 11H5a2 2 0 00-2 2v7a2 2 0 002 2h14a2 2 0 002-2v-7a2 2 0 00-2-2zM7 11V7a5 5 0 017.966-4.03C15.963 3.704 17 5.76 17 7v4"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  ),
  UNCHECKED: (
    <svg width={24} height={24}>
      <path
        d="M19 11H5a2 2 0 00-2 2v7a2 2 0 002 2h14a2 2 0 002-2v-7a2 2 0 00-2-2zM7 11V7a5 5 0 019.9-1"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  ),
};

export const LockIcon = (props: LockIconProps) => {
  const sizeCn = `ToolIcon_size_${props.size || DEFAULT_SIZE}`;

  return (
    <label
      className={`ToolIcon ToolIcon__lock ToolIcon_type_floating ${sizeCn} zen-mode-visibility ${
        props.zenModeEnabled ? "zen-mode-visibility--hidden" : ""
      }`}
      title={`${props.title} — Q`}
    >
      <input
        className="ToolIcon_type_checkbox"
        type="checkbox"
        name={props.name}
        id={props.id}
        onChange={props.onChange}
        checked={props.checked}
        aria-label={props.title}
      />
      <div className="ToolIcon__icon">
        {props.checked ? ICONS.CHECKED : ICONS.UNCHECKED}
      </div>
    </label>
  );
};

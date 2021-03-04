import "./ToolIcon.scss";

import React from "react";
import clsx from "clsx";

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
    <svg
      width="1792"
      height="1792"
      viewBox="0 0 1792 1792"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M640 768h512v-192q0-106-75-181t-181-75-181 75-75 181v192zm832 96v576q0 40-28 68t-68 28h-960q-40 0-68-28t-28-68v-576q0-40 28-68t68-28h32v-192q0-184 132-316t316-132 316 132 132 316v192h32q40 0 68 28t28 68z" />
    </svg>
  ),
  UNCHECKED: (
    <svg
      width="1792"
      height="1792"
      viewBox="0 0 1792 1792"
      xmlns="http://www.w3.org/2000/svg"
      className="unlocked-icon rtl-mirror"
    >
      <path d="M1728 576v256q0 26-19 45t-45 19h-64q-26 0-45-19t-19-45v-256q0-106-75-181t-181-75-181 75-75 181v192h96q40 0 68 28t28 68v576q0 40-28 68t-68 28h-960q-40 0-68-28t-28-68v-576q0-40 28-68t68-28h672v-192q0-185 131.5-316.5t316.5-131.5 316.5 131.5 131.5 316.5z" />
    </svg>
  ),
};

export const LockIcon = (props: LockIconProps) => {
  return (
    <label
      className={clsx(
        "ToolIcon ToolIcon__lock ToolIcon_type_floating zen-mode-visibility",
        `ToolIcon_size_${props.size || DEFAULT_SIZE}`,
        {
          "zen-mode-visibility--hidden": props.zenModeEnabled,
        },
      )}
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

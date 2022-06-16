import "./ToolIcon.scss";

import React from "react";
import clsx from "clsx";
import { ToolButtonSize } from "./ToolButton";

type SidebarLockIconProps = {
  title?: string;
  name?: string;
  checked: boolean;
  onChange?(): void;
};

const DEFAULT_SIZE: ToolButtonSize = "medium";

const ICONS = {
  CHECKED: (
    <svg viewBox="0 0 24 24" fill="#ffffff">
      <path d="M19 22H5a3 3 0 01-3-3V5a3 3 0 013-3h14a3 3 0 013 3v14a3 3 0 01-3 3zm0-18h-9v16h9a1.01 1.01 0 001-1V5a1.01 1.01 0 00-1-1z"></path>
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

export const SidebarLockButton = (props: SidebarLockIconProps) => {
  return (
    <label
      className={clsx(
        "ToolIcon ToolIcon__lock ToolIcon_type_floating",
        `ToolIcon_size_${DEFAULT_SIZE}`,
      )}
      title={`${props.title} — Q`}
    >
      <input
        className="ToolIcon_type_checkbox"
        type="checkbox"
        name={props.name}
        onChange={props.onChange}
        checked={props.checked}
        aria-label={props.title}
      />
      <div className="ToolIcon__icon side_lock_icon">
        {props.checked ? ICONS.CHECKED : ICONS.UNCHECKED}
      </div>
    </label>
  );
};

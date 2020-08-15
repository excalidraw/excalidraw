import "./ToolIcon.scss";

import React from "react";
import { t } from "../i18n";

export type Appearence = "light" | "dark";

// We chose to use only explicit toggle and not a third option for system value,
// but this could be added in the future.
export const DarkModeToggle = (props: {
  value: Appearence;
  onChange: (value: Appearence) => void;
}) => {
  return (
    <label
      className={`ToolIcon ToolIcon__lock ToolIcon_type_floating ToolIcon_size_M`}
      title={t("buttons.toggleDarkMode")}
    >
      <input
        className="ToolIcon_type_checkbox ToolIcon_toggle_opaque"
        type="checkbox"
        onChange={(event) =>
          props.onChange(event.target.checked ? "dark" : "light")
        }
        checked={props.value === "dark"}
        aria-label={t("buttons.toggleDarkMode")}
      />
      <div className="ToolIcon__icon">
        {props.value === "light" ? ICONS.MOON : ICONS.SUN}
      </div>
    </label>
  );
};

const ICONS = {
  SUN: (
    <svg width={24} height={24} fill="none">
      <path
        d="M12 17a5 5 0 100-10 5 5 0 000 10zM12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  ),
  MOON: (
    <svg width={24} height={24} fill="none">
      <path
        d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  ),
};

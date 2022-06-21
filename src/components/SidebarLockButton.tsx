import "./ToolIcon.scss";

import React from "react";
import clsx from "clsx";
import { ToolButtonSize } from "./ToolButton";
import { t } from "../i18n";
import { Tooltip } from "./Tooltip";

import "./SidebarLockButton.scss";

type SidebarLockIconProps = {
  checked: boolean;
  onChange?(): void;
};

const DEFAULT_SIZE: ToolButtonSize = "medium";

const SIDE_LIBRARY_TOGGLE_ICON = (
  <svg viewBox="0 0 24 24" fill="#ffffff">
    <path d="M19 22H5a3 3 0 01-3-3V5a3 3 0 013-3h14a3 3 0 013 3v14a3 3 0 01-3 3zm0-18h-9v16h9a1.01 1.01 0 001-1V5a1.01 1.01 0 00-1-1z"></path>
  </svg>
);

export const SidebarLockButton = (props: SidebarLockIconProps) => {
  return (
    <Tooltip label={t("labels.sidebarLock")}>
      <label
        className={clsx(
          "ToolIcon ToolIcon__lock ToolIcon_type_floating",
          `ToolIcon_size_${DEFAULT_SIZE}`,
        )}
      >
        <input
          className="ToolIcon_type_checkbox"
          type="checkbox"
          onChange={props.onChange}
          checked={props.checked}
          aria-label={t("labels.sidebarLock")}
        />{" "}
        <div className="ToolIcon__icon side_lock_icon" tabIndex={0}>
          {SIDE_LIBRARY_TOGGLE_ICON}
        </div>{" "}
      </label>{" "}
    </Tooltip>
  );
};

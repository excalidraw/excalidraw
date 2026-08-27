import clsx from "clsx";

import "./ToolIcon.scss";

import { LockedIcon, UnlockedIcon } from "./icons";

import type { ToolButtonSize } from "./ToolButton";

type LockIconProps = {
  title?: string;
  name?: string;
  checked: boolean;
  onChange?(): void;
  isMobile?: boolean;
};

const DEFAULT_SIZE: ToolButtonSize = "medium";

const ICONS = {
  CHECKED: LockedIcon,
  UNCHECKED: UnlockedIcon,
};

export const LockButton = (props: LockIconProps) => {
  return (
    <label
      className={clsx(
        "ToolIcon ToolIcon__lock",
        `ToolIcon_size_${DEFAULT_SIZE}`,
        {
          "is-mobile": props.isMobile,
        },
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
        data-testid="toolbar-lock"
      />
      <div className="ToolIcon__icon">
        {props.checked ? ICONS.CHECKED : ICONS.UNCHECKED}
      </div>
    </label>
  );
};

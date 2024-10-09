import "./ToolIcon.scss";

import clsx from "clsx";
import { ToolButtonSize } from "./ToolButton";
import { LockedIcon, UnlockedIcon } from "./icons";

type LockElementIconProps = {
  title?: string;
  name?: string;
  checked: boolean;
  disabled?: boolean;
  onChange?(): void;
  isMobile?: boolean;
};

const DEFAULT_SIZE: ToolButtonSize = "medium";

const ICONS = {
  CHECKED: LockedIcon,
  UNCHECKED: UnlockedIcon,
};

export const LockElementButton = (props: LockElementIconProps) => {
  return (
    <label
      className={clsx(
        "ToolIcon ToolIcon__lock",
        `ToolIcon_size_${DEFAULT_SIZE}`,
        {
          "is-mobile": props.isMobile,
        },
        {
          disabled: props.disabled,
        },
      )}
      title={`${props.title} — Ctrl + Shift + L`}
    >
      <input
        className="ToolIcon_type_checkbox"
        type="checkbox"
        name={props.name}
        onChange={props.onChange}
        checked={props.checked}
        disabled={props.disabled}
        aria-label={props.title}
        data-testid="toolbar-lock"
      />
      <div className="ToolIcon__icon">
        {props.checked ? ICONS.CHECKED : ICONS.UNCHECKED}
      </div>
    </label>
  );
};

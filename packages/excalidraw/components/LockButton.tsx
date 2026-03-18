import clsx from "clsx";

import "./ToolIcon.scss";

import { LockedIcon, UnlockedIcon } from "./icons";
import { Tooltip } from "./Tooltip";

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
  const tooltipLabel = `${props.title} — Q`;
  const labelElement = (
    <label
      className={clsx(
        "ToolIcon ToolIcon__lock",
        `ToolIcon_size_${DEFAULT_SIZE}`,
        {
          "is-mobile": props.isMobile,
        },
      )}
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

  return props.title ? (
    <Tooltip label={tooltipLabel}>{labelElement}</Tooltip>
  ) : (
    labelElement
  );
};

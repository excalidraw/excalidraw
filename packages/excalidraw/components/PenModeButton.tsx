import clsx from "clsx";

import "./ToolIcon.scss";

import { PenModeIcon } from "./icons";

import type { ToolButtonSize } from "./ToolButton";

type PenModeIconProps = {
  title?: string;
  name?: string;
  checked: boolean;
  onChange?(): void;
  zenModeEnabled?: boolean;
  isMobile?: boolean;
  penDetected: boolean;
};

const DEFAULT_SIZE: ToolButtonSize = "medium";

export const PenModeButton = (props: PenModeIconProps) => {
  if (!props.penDetected) {
    return null;
  }

  return (
    <label
      className={clsx(
        "ToolIcon ToolIcon__penMode",
        `ToolIcon_size_${DEFAULT_SIZE}`,
        {
          "is-mobile": props.isMobile,
        },
      )}
      title={`${props.title}`}
    >
      <input
        className="ToolIcon_type_checkbox"
        type="checkbox"
        name={props.name}
        onChange={props.onChange}
        checked={props.checked}
        aria-label={props.title}
      />
      <div className="ToolIcon__icon">{PenModeIcon}</div>
    </label>
  );
};

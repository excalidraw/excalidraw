import clsx from "clsx";

import "./ToolIcon.scss";

import { laserPointerToolIcon } from "./icons";

import type { ToolButtonSize } from "./ToolButton";

type LaserPointerIconProps = {
  title?: string;
  name?: string;
  checked: boolean;
  onChange?(): void;
  isMobile?: boolean;
};

const DEFAULT_SIZE: ToolButtonSize = "small";

export const LaserPointerButton = (props: LaserPointerIconProps) => {
  return (
    <label
      className={clsx(
        "ToolIcon ToolIcon__LaserPointer",
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
        data-testid="toolbar-LaserPointer"
      />
      <div className="ToolIcon__icon">{laserPointerToolIcon}</div>
    </label>
  );
};

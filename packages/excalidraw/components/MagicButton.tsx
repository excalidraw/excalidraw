import clsx from "clsx";

import "./ToolIcon.scss";

import type { ToolButtonSize } from "./ToolButton";
import type { JSX } from "react";

const DEFAULT_SIZE: ToolButtonSize = "small";

export const ElementCanvasButton = (props: {
  title?: string;
  icon: JSX.Element;
  name?: string;
  checked: boolean;
  onChange?(): void;
  isMobile?: boolean;
}) => {
  return (
    <label
      className={clsx(
        "ToolIcon ToolIcon__MagicButton",
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
      <div className="ToolIcon__icon">{props.icon}</div>
    </label>
  );
};

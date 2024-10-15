import "./ToolIcon.scss";

import clsx from "clsx";
import type { ToolButtonSize } from "./ToolButton";
import { FullscreenModeIcon } from "./icons";

type FullscreenModeIconProps = {
  title?: string;
  name?: string;
  checked: boolean;
  onChange?(): void;
  isMobile?: boolean;
};

const DEFAULT_SIZE: ToolButtonSize = "medium";

export const FullscreenModeButton = (props: FullscreenModeIconProps) => {
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
      <div className="ToolIcon__icon">{FullscreenModeIcon}</div>
    </label>
  );
};

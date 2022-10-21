import "./ToolIcon.scss";

import clsx from "clsx";
import { ToolButtonSize } from "./ToolButton";
import { FreedrawIcon, LockedIcon, UnlockedIcon } from "./icons";

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
      <div className="ToolIcon__icon">
        {props.checked ? (
          <div className="penmode-button">
            <div className="penmode-button__pen">{FreedrawIcon}</div>
            <div className="penmode-button__lock">{LockedIcon}</div>
          </div>
        ) : (
          <div className="penmode-button">
            <div className="penmode-button__pen">{FreedrawIcon}</div>
            <div className="penmode-button__lock">{UnlockedIcon}</div>
          </div>
        )}
      </div>
    </label>
  );
};

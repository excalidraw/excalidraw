import "./ToolIcon.scss";

import clsx from "clsx";
import { ToolButtonSize } from "./ToolButton";
import { LockedIcon, UnlockedIcon } from "./icons";

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
  const handleButtonClick = () => {
    if (props.onChange) {
      props.onChange();
    }
    const checked = !props.checked;
    const button = document.querySelector(".ToolIcon_type_button");
    if (button) {
      button.setAttribute("data-checked", checked ? "true" : "false");
    }
  };

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
      <button
        className="ToolIcon_type_button"
        type="button"
        data-checked={props.checked ? "true" : "false"}
        name={props.name}
        onClick={handleButtonClick}
        aria-label={props.title}
        data-testid="toolbar-lock"
      />
      <div className="ToolIcon__icon">
        {props.checked ? ICONS.CHECKED : ICONS.UNCHECKED}
      </div>
    </label>
  );
};

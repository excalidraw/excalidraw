import "./ToolIcon.scss";

import clsx from "clsx";
import { ToolButtonSize } from "./ToolButton";

type PenLockIconProps = {
  title?: string;
  name?: string;
  checked: boolean;
  onChange?(): void;
  zenModeEnabled?: boolean;
  isMobile?: boolean;
  elementType: string;
};

const DEFAULT_SIZE: ToolButtonSize = "medium";

const ICONS = {
  CHECKED: (
    <svg
      width="205"
      height="205"
      viewBox="0 0 205 205"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="m35 195-25-29.17V50h50v115l-25 30" />
      <path d="M10 40V10h50v30H10" />
      <path d="M125 145h70v50h-70" />
      <path d="M190 145v-30l-10-20h-40l-10 20v30h15v-30l5-5h20l5 5v30h15" />
    </svg>
  ),
  UNCHECKED: (
    <svg
      width="205"
      height="205"
      viewBox="0 0 205 205"
      xmlns="http://www.w3.org/2000/svg"
      className="unlocked-icon rtl-mirror"
    >
      <path d="m35 195-25-29.17V50h50v115l-25 30" />
      <path d="M10 40V10h50v30H10" />
      <path d="M125 145h70v50h-70" />
      <path d="M145 145v-30l-10-20H95l-10 20v30h15v-30l5-5h20l5 5v30h15" />
    </svg>
  ),
};

export const PenLockButton = (props: PenLockIconProps) => {
  if (props.elementType !== "freedraw") {
    return null;
  }
  return (
    <label
      className={clsx(
        "ToolIcon ToolIcon__penLock ToolIcon_type_floating",
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
        {props.checked ? ICONS.CHECKED : ICONS.UNCHECKED}
      </div>
    </label>
  );
};

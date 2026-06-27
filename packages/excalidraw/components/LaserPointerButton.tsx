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
  persistent?: boolean;
  onPersistentToggle?(): void;
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
      title={`${props.title}${props.persistent ? " (persistent)" : ""}`}
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
      <div className="ToolIcon__icon">
        {laserPointerToolIcon}
        {props.persistent && (
          <div
            style={{
              position: "absolute",
              bottom: 1,
              right: 1,
              width: 6,
              height: 6,
              borderRadius: "50%",
              backgroundColor: "var(--color-primary)",
            }}
            title="Persistent mode on"
          />
        )}
      </div>
    </label>
  );
};

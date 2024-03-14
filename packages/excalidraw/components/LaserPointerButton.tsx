import "./ToolIcon.scss";

import clsx from "clsx";
import { ToolButton } from "./ToolButton";
import { laserPointerToolIcon } from "./icons";

type LaserPointerIconProps = {
  title?: string;
  name?: string;
  checked: boolean;
  onChange?(): void;
  isMobile?: boolean;
};

export const LaserPointerButton = (props: LaserPointerIconProps) => {
  return (
    <ToolButton
      className={clsx("Shape", { fillable: false })}
      type="radio"
      icon={laserPointerToolIcon}
      name="editor-current-shape"
      checked={props.checked}
      title={`${props.title}`}
      aria-label={`${props.title}`}
      data-testid={`toolbar-LaserPointer`}
      onChange={props.onChange}
    />
  );
};

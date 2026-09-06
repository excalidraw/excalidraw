import clsx from "clsx";

import { IconButton } from "./IconButton";
import { laserPointerToolIcon } from "./icons";

type LaserPointerButtonProps = {
  title?: string;
  checked: boolean;
  onChange?(): void;
  isMobile?: boolean;
};

export const LaserPointerButton = (props: LaserPointerButtonProps) => {
  return (
    <IconButton
      className={clsx("ToolIcon__LaserPointer", {
        "is-mobile": props.isMobile,
      })}
      type="toggle"
      size="small"
      icon={laserPointerToolIcon}
      checked={props.checked}
      title={`${props.title}`}
      aria-label={`${props.title}`}
      data-testid="toolbar-LaserPointer"
      onSelect={() => props.onChange?.()}
    />
  );
};

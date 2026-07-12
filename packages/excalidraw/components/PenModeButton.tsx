import clsx from "clsx";

import { ToolButton } from "./ToolButton";
import { PenModeIcon } from "./icons";

type PenModeButtonProps = {
  title?: string;
  checked: boolean;
  onChange?(): void;
  isMobile?: boolean;
  penDetected: boolean;
};

export const PenModeButton = (props: PenModeButtonProps) => {
  if (!props.penDetected) {
    return null;
  }

  return (
    <ToolButton
      className={clsx("ToolIcon__penMode", { "is-mobile": props.isMobile })}
      type="toggle"
      icon={PenModeIcon}
      checked={props.checked}
      title={`${props.title}`}
      aria-label={`${props.title}`}
      onSelect={() => props.onChange?.()}
    />
  );
};

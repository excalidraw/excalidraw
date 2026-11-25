import clsx from "clsx";

import { IconButton } from "./IconButton";
import { LockedIcon, UnlockedIcon } from "./icons";

type LockButtonProps = {
  title?: string;
  checked: boolean;
  onChange?(): void;
  isMobile?: boolean;
  disabled?: boolean;
};

export const LockButton = (props: LockButtonProps) => {
  return (
    <IconButton
      className={clsx("ToolIcon__lock", { "is-mobile": props.isMobile })}
      type="toggle"
      icon={props.checked ? LockedIcon : UnlockedIcon}
      checked={props.checked}
      disabled={props.disabled}
      title={`${props.title} — Q`}
      aria-label={`${props.title}`}
      data-testid="toolbar-lock"
      onSelect={() => props.onChange?.()}
    />
  );
};

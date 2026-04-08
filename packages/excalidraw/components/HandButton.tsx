import clsx from "clsx";

import { KEYS } from "@nous-excalidraw/common";

import { ToolButton } from "./ToolButton";
import { handIcon } from "./icons";

import "./ToolIcon.scss";

type LockIconProps = {
  title?: string;
  name?: string;
  checked: boolean;
  onChange?(): void;
  isMobile?: boolean;
};

export const HandButton = (props: LockIconProps) => {
  return (
    <ToolButton
      className={clsx("Shape", { fillable: false, active: props.checked })}
      type="radio"
      icon={handIcon}
      name="editor-current-shape"
      checked={props.checked}
      title={`${props.title} — H`}
      keyBindingLabel={!props.isMobile ? KEYS.H.toLocaleUpperCase() : undefined}
      aria-label={`${props.title} — H`}
      aria-keyshortcuts={KEYS.H}
      data-testid={`toolbar-hand`}
      onChange={() => props.onChange?.()}
    />
  );
};

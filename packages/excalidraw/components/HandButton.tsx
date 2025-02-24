import "./ToolIcon.scss";

import clsx from "clsx";
import { ToolButton } from "./ToolButton";
import { handIcon } from "./icons";
import { KEYS } from "../keys";
import { useRef } from "react";

type LockIconProps = {
  title?: string;
  name?: string;
  checked: boolean;
  onChange?(): void;
  isMobile?: boolean;
};

export const HandButton = (props: LockIconProps) => {
  const compoRef = useRef<HTMLInputElement | HTMLButtonElement>(null);
  return (
    <ToolButton
      ref={compoRef}
      className={clsx("Shape", { fillable: false })}
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

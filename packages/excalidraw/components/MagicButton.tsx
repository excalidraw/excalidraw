import clsx from "clsx";

import { ToolButton } from "./ToolButton";

import type { JSX } from "react";

export const ElementCanvasButton = (props: {
  title?: string;
  icon: JSX.Element;
  checked: boolean;
  onChange?(): void;
  isMobile?: boolean;
}) => {
  return (
    <ToolButton
      className={clsx("ToolIcon__MagicButton", {
        "is-mobile": props.isMobile,
      })}
      type="toggle"
      size="small"
      icon={props.icon}
      checked={props.checked}
      title={`${props.title}`}
      aria-label={`${props.title}`}
      onSelect={() => props.onChange?.()}
    />
  );
};

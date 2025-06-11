import clsx from "clsx";

import "./ToolIcon.scss";

import { KEYS } from "@excalidraw/common";

import { ToolButton } from "./ToolButton";

import { laserPointerToolIcon } from "./icons";

import type { ToolButtonSize } from "./ToolButton";

type LaserPointerIconProps = {
  title?: string;
  name?: string;
  checked: boolean;
  onChange?(): void;
  isMobile?: boolean;
};

const DEFAULT_SIZE: ToolButtonSize = "small";

export const LaserPointerButton = (props: LaserPointerIconProps) => {
  return (
    <ToolButton
    className={clsx("Shape", { fillable: false })}
    type="radio"
    icon={laserPointerToolIcon}
    name="editor-current-shape"
    checked={props.checked}
    title={`${props.title} — H`}
    keyBindingLabel={!props.isMobile ? KEYS.H.toLocaleUpperCase() : undefined}
    aria-label={`${props.title} — H`}
    aria-keyshortcuts={KEYS.H}
    data-testid={`toolbar-laser`}
    onChange={() => props.onChange?.()}
    />  );
};

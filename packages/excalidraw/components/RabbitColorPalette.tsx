import clsx from "clsx";

import { KEYS } from "@excalidraw/common";

import { ToolButton } from "./ToolButton";
import { RabbitColorPaletteIcon } from "./icons";

import "./ToolIcon.scss";

type PaletteIconProps = {
  title?: string;
  name?: string;
  checked: boolean;
  onChange?(): void;
  isMobile?: boolean;
};

export const RabbitColorPaletteButton = ({
  title,
  isMobile,
  onChange,
}: PaletteIconProps) => {
  return (
    <ToolButton
      className="ToolIcon"
      type="button"
      icon={RabbitColorPaletteIcon}
      title={`${title} — H`}
      keyBindingLabel={!isMobile ? KEYS.H.toLocaleUpperCase() : undefined}
      aria-label={`${title} — H`}
      aria-keyshortcuts={KEYS.H}
      data-testid="toolbar-search"
      onClick={() => onChange?.()}
    />
  );
};


import clsx from "clsx";

import { KEYS } from "@excalidraw/common";

import { ToolButton } from "./ToolButton";
import { RabbitSearchIcon } from "./icons";

import "./ToolIcon.scss";

type SearchIconProps = {
  title?: string;
  name?: string;
  checked: boolean;
  onChange?(): void;
  isMobile?: boolean;
};

export const RabbitSearchButton = ({
  title,
  isMobile,
  onChange,
}: SearchIconProps) => {
  return (
    <ToolButton
      className="ToolIcon"
      type="button"
      icon={RabbitSearchIcon}
      title={`${title} — H`}
      keyBindingLabel={!isMobile ? KEYS.H.toLocaleUpperCase() : undefined}
      aria-label={`${title} — H`}
      aria-keyshortcuts={KEYS.H}
      data-testid="toolbar-search"
      onClick={() => onChange?.()}
    />
  );
};


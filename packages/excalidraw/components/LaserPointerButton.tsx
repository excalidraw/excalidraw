import clsx from "clsx";

import { t } from "../i18n";

import { IconButton } from "./IconButton";
import { laserPointerToolIcon } from "./icons";

type LaserPointerButtonProps = {
  title?: string;
  checked: boolean;
  onChange?(): void;
  isMobile?: boolean;
  persistent?: boolean;
};

export const LaserPointerButton = (props: LaserPointerButtonProps) => {
  return (
    <IconButton
      className={clsx("ToolIcon__LaserPointer", {
        "is-mobile": props.isMobile,
        "is-persistent": props.persistent,
      })}
      type="toggle"
      size="small"
      icon={laserPointerToolIcon}
      checked={props.checked}
      title={`${props.title}${
        props.persistent ? ` — ${t("toolBar.laserPersistent")}` : ""
      }`}
      aria-label={`${props.title}${
        props.persistent ? ` — ${t("toolBar.laserPersistent")}` : ""
      }`}
      data-testid="toolbar-LaserPointer"
      onSelect={() => props.onChange?.()}
    />
  );
};

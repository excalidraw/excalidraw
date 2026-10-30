import clsx from "clsx";

import { IconButton } from "./IconButton";
import {
  hideCollaboratorsCursorIcon,
  showCollaboratorsCursorIcon,
} from "./icons";

type HideCollaboratorsCursorButtonProps = {
  title?: string;
  checked: boolean;
  onChange?(): void;
  isMobile?: boolean;
  isHidden: boolean;
};

export const HideCollaboratorsCursorButton = (
  props: HideCollaboratorsCursorButtonProps,
) => {
  return (
    <IconButton
      className={clsx("ToolIcon__HideCollaborators", {
        "is-mobile": props.isMobile,
      })}
      type="toggle"
      size="small"
      icon={
        props.isHidden
          ? hideCollaboratorsCursorIcon
          : showCollaboratorsCursorIcon
      }
      checked={props.checked}
      title={`${props.title}`}
      aria-label={`${props.title}`}
      data-testid="toolbar-HideCollaborators"
      onSelect={() => props.onChange?.()}
    />
  );
};

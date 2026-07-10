import "./ToolIcon.scss";

import clsx from "clsx";
import type { ToolButtonSize } from "./ToolButton";
import {
  hideCollaboratorsCursorIcon,
  showCollaboratorsCursorIcon,
} from "./icons";

type HideCollaboratorsCursorButtonProps = {
  title?: string;
  name?: string;
  checked: boolean;
  onChange?(): void;
  isMobile?: boolean;
  isHidden: boolean;
};

const DEFAULT_SIZE: ToolButtonSize = "small";

export const HideCollaboratorsCursorButton = (
  props: HideCollaboratorsCursorButtonProps,
) => {
  return (
    <label
      className={clsx(
        "ToolIcon ToolIcon__HideCollaborators",
        `ToolIcon_size_${DEFAULT_SIZE}`,
        {
          "is-mobile": props.isMobile,
        },
      )}
      title={`${props.title}`}
    >
      <input
        className="ToolIcon_type_checkbox"
        type="checkbox"
        name={props.name}
        onChange={props.onChange}
        checked={props.checked}
        aria-label={props.title}
        data-testid="toolbar-HideCollaborators"
      />
      <div className="ToolIcon__icon">
        {props.isHidden
          ? hideCollaboratorsCursorIcon
          : showCollaboratorsCursorIcon}
      </div>
    </label>
  );
};

import clsx from "clsx";

import "./ToolIcon.scss";

import { laserPointerToolIcon } from "./icons";

import type { ToolButtonSize } from "./ToolButton";

type AnnotationIconProps = {
  title?: string;
  name?: string;
  checked: boolean;
  onChange?(): void;
  isMobile?: boolean;
};

const DEFAULT_SIZE: ToolButtonSize = "small";

export const AnnotationButton = (props: AnnotationIconProps) => {
  return (
    <label
      className={clsx(
        "ToolIcon ToolIcon__Annotation",
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
<<<<<<< HEAD
        data-testid="toolbar-annotation"
=======
        data-testid="toolbar-Annotation"
>>>>>>> 607f1d3a58a3d3dd8968ec557793534637a83da2
      />
      <div className="ToolIcon__icon">{laserPointerToolIcon}</div>
    </label>
  );
};

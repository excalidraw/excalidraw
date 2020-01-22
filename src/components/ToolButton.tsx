import "./ToolIcon.scss";

import React from "react";

type ToolIconSize = "s" | "m";

type ToolIconProps =
  | {
      type: "button";
      icon: React.ReactNode;
      "aria-label": string;
      "aria-keyshortcuts"?: string;
      title?: string;
      name?: string;
      id?: string;
      onClick?(): void;
      size?: ToolIconSize;
    }
  | {
      type: "radio";
      icon: React.ReactNode;
      "aria-label": string;
      "aria-keyshortcuts"?: string;
      title?: string;
      name?: string;
      id?: string;
      checked: boolean;
      onChange?(): void;
      size?: ToolIconSize;
    };

const DEFAULT_SIZE: ToolIconSize = "m";

export function ToolButton(props: ToolIconProps) {
  const sizeCn = `ToolIcon_size_${props.size || DEFAULT_SIZE}`;

  if (props.type === "button")
    return (
      <button
        className={`ToolIcon_type_button ToolIcon ${sizeCn}`}
        title={props.title}
        aria-label={props["aria-label"]}
        type="button"
        onClick={props.onClick}
      >
        <div className="ToolIcon__icon" aria-hidden="true">
          {props.icon}
        </div>
      </button>
    );

  return (
    <label className="ToolIcon">
      <input
        className={`ToolIcon_type_radio ${sizeCn}`}
        type="radio"
        name={props.name}
        title={props.title}
        aria-label={props["aria-label"]}
        aria-keyshortcuts={props["aria-keyshortcuts"]}
        id={props.id}
        onChange={props.onChange}
        checked={props.checked}
      />
      <div className="ToolIcon__icon">{props.icon}</div>
    </label>
  );
}

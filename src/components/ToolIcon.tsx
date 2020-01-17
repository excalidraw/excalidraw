import "./ToolIcon.scss";

import React from "react";

type ToolIconProps =
  | {
      type: "button";
      icon: React.ReactNode;
      "aria-label": string;
      title?: string;
      name?: string;
      id?: string;
      onClick?(): void;
    }
  | {
      type: "radio";
      icon: React.ReactNode;
      title?: string;
      name?: string;
      id?: string;
      checked: boolean;
      onChange?(): void;
    };

export function ToolIcon(props: ToolIconProps) {
  if (props.type === "button")
    return (
      <label className="ToolIcon" title={props.title}>
        <button
          className="ToolIcon_type_button"
          aria-label={props["aria-label"]}
          type="button"
          onClick={props.onClick}
        >
          <div className="ToolIcon__icon">{props.icon}</div>
        </button>
      </label>
    );

  return (
    <label className="ToolIcon" title={props.title}>
      <input
        className="ToolIcon_type_radio"
        type="radio"
        name={props.name}
        id={props.id}
        onChange={props.onChange}
        checked={props.checked}
      />
      <div className="ToolIcon__icon">{props.icon}</div>
    </label>
  );
}

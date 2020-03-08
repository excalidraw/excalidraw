import "./ToolIcon.scss";
import "./LiveButton.css";

import { broadcast } from "./icons";
import { ToolIconSize } from "./ToolButton";
import React from "react";

type LiveButtonProps = {
  "aria-label": string;
  "aria-keyshortcuts"?: string;
  count: number;
  label?: string;
  title?: string;
  name?: string;
  id?: string;
  isLive: boolean;
  size?: ToolIconSize;
  keyBindingLabel?: string;
  showAriaLabel?: boolean;
  onClick?(): void;
};

export const LiveButton = React.forwardRef(function(
  props: LiveButtonProps,
  ref,
) {
  const innerRef = React.useRef(null);
  React.useImperativeHandle(ref, () => innerRef.current);
  return (
    <button
      className={`ToolIcon_type_button ToolIcon LiveButton${
        props.isLive ? " IsLive" : ""
      }${props.count > 0 ? " HasLiveCount" : ""}`}
      title={props.title}
      aria-label={props["aria-label"]}
      type="button"
      onClick={props.onClick}
      ref={innerRef}
    >
      <div className="ToolIcon__icon" aria-hidden="true">
        {broadcast}
      </div>
      {props.showAriaLabel && (
        <div className="ToolIcon__label">{props["aria-label"]}</div>
      )}
      {props.count > 0 && (
        <div className="ToolIcon__label LiveCount">{props.count}</div>
      )}
    </button>
  );
});

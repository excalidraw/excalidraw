import React from "react";
import { questionCircle } from "../components/icons";

type HelpIconProps = {
  title?: string;
  name?: string;
  id?: string;
  onClick?(): void;
};

export const HelpIcon = (props: HelpIconProps) => (
  <label title={`${props.title} — ?`} className="help-icon">
    <div onClick={props.onClick}>{questionCircle}</div>
  </label>
);

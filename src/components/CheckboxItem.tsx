import React from "react";
import clsx from "clsx";
import { checkIcon } from "./icons";

import "./CheckboxItem.scss";

export const CheckboxItem: React.FC<{
  checked: boolean;
  onChange: (checked: boolean) => void;
}> = ({ children, checked, onChange }) => {
  return (
    <div
      className={clsx("Checkbox", { "is-checked": checked })}
      onClick={(event) => {
        onChange(!checked);
        ((event.currentTarget as HTMLDivElement).querySelector(
          ".Checkbox-box",
        ) as HTMLButtonElement).focus();
      }}
    >
      <button className="Checkbox-box" role="checkbox" aria-checked={checked}>
        {checkIcon}
      </button>
      <div className="Checkbox-label">{children}</div>
    </div>
  );
};

import clsx from "clsx";
import React, { useState } from "react";

import { randomId } from "@excalidraw/common";

import { checkIcon } from "./icons";

import "./CheckboxItem.scss";

export const CheckboxItem: React.FC<{
  checked: boolean;
  onChange: (checked: boolean, event: React.MouseEvent) => void;
  className?: string;
  children?: React.ReactNode;
}> = ({ children, checked, onChange, className }) => {
  const [labelId] = useState(() => `checkbox-label-${randomId()}`);

  return (
    <div
      className={clsx("Checkbox", className, { "is-checked": checked })}
      onClick={(event) => {
        onChange(!checked, event);
        (
          (event.currentTarget as HTMLDivElement).querySelector(
            ".Checkbox-box",
          ) as HTMLButtonElement
        ).focus();
      }}
    >
      <button
        type="button"
        className="Checkbox-box"
        role="checkbox"
        aria-checked={checked}
        aria-labelledby={labelId}
      >
        {checkIcon}
      </button>
      <div className="Checkbox-label" id={labelId}>
        {children}
      </div>
    </div>
  );
};

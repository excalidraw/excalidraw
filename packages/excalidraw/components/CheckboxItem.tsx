import React from "react";
import clsx from "clsx";
import { checkIcon } from "./icons";

import "./CheckboxItem.scss";

export const CheckboxItem: React.FC<{
  checked: boolean;
  onChange: (checked: boolean, event: React.MouseEvent) => void;
  className?: string;
  children?: React.ReactNode;
}> = ({ children, checked, onChange, className }) => {
  const btnRef = React.useRef<HTMLButtonElement>(null);

  return (
    <div
      className={clsx("Checkbox", className, { "is-checked": checked })}
      onClick={() => {
        btnRef.current?.focus();
      }}
    >
      <button
        className="Checkbox-box"
        role="checkbox"
        aria-checked={checked}
        ref={btnRef}
      >
        {checkIcon}
      </button>
      <div className="Checkbox-label">{children}</div>
    </div>
  );
};

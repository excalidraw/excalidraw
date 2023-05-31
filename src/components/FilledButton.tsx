import React, { forwardRef } from "react";
import clsx from "clsx";

import "./FilledButton.scss";

export type ButtonVariant = "filled" | "outlined" | "icon";
export type ButtonColor = "primary" | "danger";

export type FilledButtonProps = {
  label: string;

  children?: React.ReactNode;
  onClick?: () => void;

  variant?: ButtonVariant;
  color?: ButtonColor;
  className?: string;

  startIcon?: React.ReactNode;
};

export const FilledButton = forwardRef<HTMLButtonElement, FilledButtonProps>(
  (
    {
      children,
      startIcon,
      onClick,
      label,
      variant = "filled",
      color = "primary",
      className,
    },
    ref,
  ) => {
    return (
      <button
        className={clsx(
          "ExcButton",
          `ExcButton--${color}`,
          `ExcButton--${variant}`,
          className,
        )}
        onClick={onClick}
        type="button"
        aria-label={label}
        ref={ref}
      >
        {startIcon && (
          <div className="ExcButton__icon" aria-hidden>
            {startIcon}
          </div>
        )}
        {variant !== "icon" && (children ?? label)}
      </button>
    );
  },
);

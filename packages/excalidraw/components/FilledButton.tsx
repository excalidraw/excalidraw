import React, { forwardRef, useState } from "react";
import clsx from "clsx";

import "./FilledButton.scss";
import Spinner from "./Spinner";
import { AbortError } from "../errors";

export type ButtonVariant = "filled" | "outlined" | "icon";
export type ButtonColor = "primary" | "danger" | "warning" | "muted";
export type ButtonSize = "medium" | "large";

export type FilledButtonProps = {
  label: string;

  children?: React.ReactNode;
  onClick?: () => void;

  variant?: ButtonVariant;
  color?: ButtonColor;
  size?: ButtonSize;
  className?: string;
  fullWidth?: boolean;

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
      size = "medium",
      fullWidth,
      className,
    },
    ref,
  ) => {
    const [isLoading, setIsLoading] = useState(false);

    const _onClick = async (event: React.MouseEvent) => {
      const ret = onClick?.();

      if (ret && "then" in ret) {
        try {
          setIsLoading(true);
          await ret;
        } catch (error: any) {
          if (!(error instanceof AbortError)) {
            throw error;
          } else {
            console.warn(error);
          }
        } finally {
          setIsLoading(false);
        }
      }
    };

    return (
      <button
        className={clsx(
          "ExcButton",
          `ExcButton--color-${color}`,
          `ExcButton--variant-${variant}`,
          `ExcButton--size-${size}`,
          { "ExcButton--fullWidth": fullWidth },
          className,
        )}
        onClick={_onClick}
        type="button"
        aria-label={label}
        ref={ref}
        disabled={isLoading}
      >
        {startIcon && (
          <div className="ExcButton__icon" aria-hidden>
            {startIcon}
          </div>
        )}
        {variant !== "icon" && (children ?? label)}
        {isLoading && <Spinner />}
      </button>
    );
  },
);

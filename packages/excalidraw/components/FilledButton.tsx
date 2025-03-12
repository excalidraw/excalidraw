import clsx from "clsx";
import React, { forwardRef, useState } from "react";

import { AbortError } from "../errors";
import { isPromiseLike } from "../utils";

import Spinner from "./Spinner";
import { tablerCheckIcon } from "./icons";

import "./FilledButton.scss";

export type ButtonVariant = "filled" | "outlined" | "icon";
export type ButtonColor =
  | "primary"
  | "danger"
  | "warning"
  | "muted"
  | "success";
export type ButtonSize = "medium" | "large";

export type FilledButtonProps = {
  label: string;

  children?: React.ReactNode;
  onClick?: (event: React.MouseEvent) => void;
  status?: null | "loading" | "success";

  variant?: ButtonVariant;
  color?: ButtonColor;
  size?: ButtonSize;
  className?: string;
  fullWidth?: boolean;

  icon?: React.ReactNode;
};

export const FilledButton = forwardRef<HTMLButtonElement, FilledButtonProps>(
  (
    {
      children,
      icon,
      onClick,
      label,
      variant = "filled",
      color = "primary",
      size = "medium",
      fullWidth,
      className,
      status,
    },
    ref,
  ) => {
    const [isLoading, setIsLoading] = useState(false);

    const _onClick = async (event: React.MouseEvent) => {
      const ret = onClick?.(event);

      if (isPromiseLike(ret)) {
        // delay loading state to prevent flicker in case of quick response
        const timer = window.setTimeout(() => {
          setIsLoading(true);
        }, 50);
        try {
          await ret;
        } catch (error: any) {
          if (!(error instanceof AbortError)) {
            throw error;
          } else {
            console.warn(error);
          }
        } finally {
          clearTimeout(timer);
          setIsLoading(false);
        }
      }
    };

    const _status = isLoading ? "loading" : status;
    color = _status === "success" ? "success" : color;

    return (
      <button
        className={clsx(
          "ExcButton",
          `ExcButton--color-${color}`,
          `ExcButton--variant-${variant}`,
          `ExcButton--size-${size}`,
          `ExcButton--status-${_status}`,
          { "ExcButton--fullWidth": fullWidth },
          className,
        )}
        onClick={_onClick}
        type="button"
        aria-label={label}
        ref={ref}
        disabled={_status === "loading" || _status === "success"}
      >
        <div className="ExcButton__contents">
          {_status === "loading" ? (
            <Spinner className="ExcButton__statusIcon" />
          ) : (
            _status === "success" && (
              <div className="ExcButton__statusIcon">{tablerCheckIcon}</div>
            )
          )}
          {icon && (
            <div className="ExcButton__icon" aria-hidden>
              {icon}
            </div>
          )}
          {variant !== "icon" && (children ?? label)}
        </div>
      </button>
    );
  },
);

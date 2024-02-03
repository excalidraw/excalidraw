import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import clsx from "clsx";

import "./FilledButton.scss";
import { AbortError } from "../errors";
import Spinner from "./Spinner";

export type ButtonVariant = "filled" | "outlined" | "icon";
export type ButtonColor = "primary" | "danger" | "warning" | "muted";
export type ButtonSize = "medium" | "large";

export type FilledButtonProps = {
  label: string;

  children?: React.ReactNode;
  onClick?: (event: React.MouseEvent) => void;

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
    },
    ref,
  ) => {
    const [isLoading, setIsLoading] = useState(false);

    const internalRef = useRef<HTMLButtonElement>(null);
    const widthRef = useRef<number | undefined>(undefined);

    useImperativeHandle(ref, () => internalRef.current!, []);

    const _onClick = async (event: React.MouseEvent) => {
      const ret = onClick?.(event);

      if (ret && "then" in ret) {
        try {
          widthRef.current = internalRef.current?.offsetWidth;
          setIsLoading(true);
          await ret;
        } catch (error: any) {
          if (!(error instanceof AbortError)) {
            throw error;
          } else {
            console.warn(error);
          }
        } finally {
          widthRef.current = undefined;
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
        ref={internalRef}
        disabled={isLoading}
        style={{
          // too keep the same width when replacing the button content
          // with a spinner
          width: widthRef.current,
        }}
      >
        {isLoading ? (
          <Spinner />
        ) : (
          <>
            {icon && (
              <div className="ExcButton__icon" aria-hidden>
                {icon}
              </div>
            )}
            {variant !== "icon" && (children ?? label)}
          </>
        )}
      </button>
    );
  },
);

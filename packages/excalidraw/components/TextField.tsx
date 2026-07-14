import clsx from "clsx";
import {
  forwardRef,
  useId,
  useRef,
  useImperativeHandle,
  useLayoutEffect,
  useState,
} from "react";

import { Button } from "./Button";
import { eyeIcon, eyeClosedIcon } from "./icons";

import "./TextField.scss";

import type { KeyboardEvent } from "react";

type TextFieldProps = {
  onChange?: (value: string) => void;
  onClick?: () => void;
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;

  readonly?: boolean;
  fullWidth?: boolean;
  selectOnRender?: boolean;

  icon?: React.ReactNode;
  label?: string;
  className?: string;
  placeholder?: string;
  isRedacted?: boolean;
  type?: "text" | "search";
  /** extra attributes (e.g. combobox aria) spread onto the inner <input> */
  inputProps?: React.InputHTMLAttributes<HTMLInputElement>;
} & ({ value: string } | { defaultValue: string });

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  (
    {
      onChange,
      label,
      fullWidth,
      placeholder,
      readonly,
      selectOnRender,
      onKeyDown,
      isRedacted = false,
      icon,
      className,
      type,
      inputProps,
      ...rest
    },
    ref,
  ) => {
    const innerRef = useRef<HTMLInputElement | null>(null);
    const labelId = useId();

    useImperativeHandle(ref, () => innerRef.current!);

    useLayoutEffect(() => {
      if (selectOnRender) {
        // focusing first is needed because vitest/jsdom
        innerRef.current?.focus();
        innerRef.current?.select();
      }
    }, [selectOnRender]);

    const [isTemporarilyUnredacted, setIsTemporarilyUnredacted] =
      useState<boolean>(false);

    return (
      <div
        className={clsx("ExcTextField", className, {
          "ExcTextField--fullWidth": fullWidth,
          "ExcTextField--hasIcon": !!icon,
        })}
        onClick={() => {
          innerRef.current?.focus();
        }}
      >
        {icon}
        {label && (
          <div className="ExcTextField__label" id={labelId}>
            {label}
          </div>
        )}
        <div
          className={clsx("ExcTextField__input", {
            "ExcTextField__input--readonly": readonly,
          })}
        >
          <input
            className={clsx({
              "is-redacted":
                "value" in rest &&
                rest.value &&
                isRedacted &&
                !isTemporarilyUnredacted,
            })}
            readOnly={readonly}
            value={"value" in rest ? rest.value : undefined}
            defaultValue={
              "defaultValue" in rest ? rest.defaultValue : undefined
            }
            placeholder={placeholder}
            aria-labelledby={label ? labelId : undefined}
            ref={innerRef}
            onChange={(event) => onChange?.(event.target.value)}
            onKeyDown={onKeyDown}
            type={type}
            {...inputProps}
          />
          {isRedacted && (
            <Button
              onSelect={() =>
                setIsTemporarilyUnredacted(!isTemporarilyUnredacted)
              }
              style={{ border: 0, userSelect: "none" }}
            >
              {isTemporarilyUnredacted ? eyeClosedIcon : eyeIcon}
            </Button>
          )}
        </div>
      </div>
    );
  },
);

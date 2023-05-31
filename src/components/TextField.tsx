import { forwardRef, useRef, useImperativeHandle, KeyboardEvent } from "react";
import clsx from "clsx";

import "./TextField.scss";

export type TextFieldProps = {
  value?: string;

  onChange?: (value: string) => void;
  onClick?: () => void;
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;

  readonly?: boolean;
  fullWidth?: boolean;

  label?: string;
  placeholder?: string;
};

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  (
    { value, onChange, label, fullWidth, placeholder, readonly, onKeyDown },
    ref,
  ) => {
    const innerRef = useRef<HTMLInputElement | null>(null);

    useImperativeHandle(ref, () => innerRef.current!);

    return (
      <div
        className={clsx("ExcTextField", {
          "ExcTextField--fullWidth": fullWidth,
        })}
        onClick={() => {
          innerRef.current?.focus();
        }}
      >
        <div className="ExcTextField__label">{label}</div>
        <div
          className={clsx("ExcTextField__input", {
            "ExcTextField__input--readonly": readonly,
          })}
        >
          <input
            readOnly={readonly}
            type="text"
            value={value}
            placeholder={placeholder}
            ref={innerRef}
            onChange={(event) => onChange?.(event.target.value)}
            onKeyDown={onKeyDown}
          />
        </div>
      </div>
    );
  },
);

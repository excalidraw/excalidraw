import {
  forwardRef,
  useRef,
  useImperativeHandle,
  KeyboardEvent,
  useLayoutEffect,
  useState,
} from "react";
import clsx from "clsx";

import "./TextField.scss";
import { Button } from "./Button";
import { eyeIcon, eyeClosedIcon } from "./icons";

type TextFieldProps = {
  value?: string;

  onChange?: (value: string) => void;
  onClick?: () => void;
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;

  readonly?: boolean;
  fullWidth?: boolean;
  selectOnRender?: boolean;

  label?: string;
  placeholder?: string;
  isPassword?: boolean;
};

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  (
    {
      value,
      onChange,
      label,
      fullWidth,
      placeholder,
      readonly,
      selectOnRender,
      onKeyDown,
      isPassword = false,
    },
    ref,
  ) => {
    const innerRef = useRef<HTMLInputElement | null>(null);

    useImperativeHandle(ref, () => innerRef.current!);

    useLayoutEffect(() => {
      if (selectOnRender) {
        innerRef.current?.select();
      }
    }, [selectOnRender]);

    const [isVisible, setIsVisible] = useState<boolean>(true);

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
            type={isPassword && isVisible ? "password" : undefined}
            readOnly={readonly}
            value={value}
            placeholder={placeholder}
            ref={innerRef}
            onChange={(event) => onChange?.(event.target.value)}
            onKeyDown={onKeyDown}
          />
          {isPassword && (
            <Button
              onSelect={() => setIsVisible(!isVisible)}
              style={{ border: 0 }}
            >
              {isVisible ? eyeIcon : eyeClosedIcon}
            </Button>
          )}
        </div>
      </div>
    );
  },
);

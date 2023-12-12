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
  isRedacted?: boolean;
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
      isRedacted = false,
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

    const [isTemporarilyUnredacted, setIsTemporarilyUnredacted] =
      useState<boolean>(false);

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
            className={clsx({
              "is-redacted": value && isRedacted && !isTemporarilyUnredacted,
            })}
            readOnly={readonly}
            value={value}
            placeholder={placeholder}
            ref={innerRef}
            onChange={(event) => onChange?.(event.target.value)}
            onKeyDown={onKeyDown}
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

import React from "react";
import { Popover } from "./Popover";

import "./IconPicker.scss";
import { isArrowKey, KEYS } from "../keys";
import { getLanguage } from "../i18n";

function Picker<T>({
  options,
  value,
  label,
  onChange,
  onClose,
}: {
  label: string;
  value: T;
  options: { value: T; text: string; icon: JSX.Element; keyBinding: string }[];
  onChange: (value: T) => void;
  onClose: () => void;
}) {
  const rFirstItem = React.useRef<HTMLButtonElement>();
  const rActiveItem = React.useRef<HTMLButtonElement>();
  const rGallery = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    // After the component is first mounted focus on first input
    if (rActiveItem.current) {
      rActiveItem.current.focus();
    } else if (rGallery.current) {
      rGallery.current.focus();
    }
  }, []);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    const pressedOption = options.find(
      (option) => option.keyBinding === event.key.toLowerCase(),
    )!;

    if (!(event.metaKey || event.altKey || event.ctrlKey) && pressedOption) {
      // Keybinding navigation
      const index = options.indexOf(pressedOption);
      (rGallery!.current!.children![index] as any).focus();
      event.preventDefault();
    } else if (event.key === KEYS.TAB) {
      // Tab navigation cycle through options. If the user tabs
      // away from the picker, close the picker. We need to use
      // a timeout here to let the stack clear before checking.
      setTimeout(() => {
        const active = rActiveItem.current;
        const docActive = document.activeElement;
        if (active !== docActive) {
          onClose();
        }
      }, 0);
    } else if (isArrowKey(event.key)) {
      // Arrow navigation
      const { activeElement } = document;
      const isRTL = getLanguage().rtl;
      const index = Array.prototype.indexOf.call(
        rGallery!.current!.children,
        activeElement,
      );
      if (index !== -1) {
        const length = options.length;
        let nextIndex = index;

        switch (event.key) {
          // Select the next option
          case isRTL ? KEYS.ARROW_LEFT : KEYS.ARROW_RIGHT:
          case KEYS.ARROW_DOWN: {
            nextIndex = (index + 1) % length;
            break;
          }
          // Select the previous option
          case isRTL ? KEYS.ARROW_RIGHT : KEYS.ARROW_LEFT:
          case KEYS.ARROW_UP: {
            nextIndex = (length + index - 1) % length;
            break;
          }
        }

        (rGallery.current!.children![nextIndex] as any).focus();
      }
      event.preventDefault();
    } else if (event.key === KEYS.ESCAPE || event.key === KEYS.ENTER) {
      // Close on escape or enter
      event.preventDefault();
      onClose();
    }
    event.nativeEvent.stopImmediatePropagation();
  };

  return (
    <div
      className={`picker`}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      onKeyDown={handleKeyDown}
    >
      <div className="picker-content" ref={rGallery}>
        {options.map((option, i) => (
          <button
            className="picker-option"
            onClick={(event) => {
              (event.currentTarget as HTMLButtonElement).focus();
              onChange(option.value);
            }}
            title={`${option.text} — ${option.keyBinding.toUpperCase()}`}
            aria-label={option.text || "none"}
            aria-keyshortcuts={option.keyBinding}
            key={option.text}
            ref={(el) => {
              if (el && i === 0) {
                rFirstItem.current = el;
              }
              if (el && option.value === value) {
                rActiveItem.current = el;
              }
            }}
            onFocus={() => {
              onChange(option.value);
            }}
          >
            {option.icon}
            <span className="picker-keybinding">{option.keyBinding}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function IconPicker<T>({
  value,
  label,
  options,
  onChange,
  group = "",
}: {
  label: string;
  value: T;
  options: { value: T; text: string; icon: JSX.Element; keyBinding: string }[];
  onChange: (value: T) => void;
  group?: string;
}) {
  const [isActive, setActive] = React.useState(false);
  const rPickerButton = React.useRef<any>(null);
  const isRTL = getLanguage().rtl;

  return (
    <label className={"picker-container"}>
      <button
        name={group}
        className={isActive ? "active" : ""}
        aria-label={label}
        onClick={() => setActive(!isActive)}
        ref={rPickerButton}
      >
        {options.find((option) => option.value === value)?.icon}
      </button>
      <React.Suspense fallback="">
        {isActive ? (
          <>
            <Popover
              onCloseRequest={(event) =>
                event.target !== rPickerButton.current && setActive(false)
              }
              {...(isRTL ? { right: 5.5 } : { left: -5.5 })}
            >
              <Picker
                options={options}
                value={value}
                label={label}
                onChange={onChange}
                onClose={() => {
                  setActive(false);
                  rPickerButton.current?.focus();
                }}
              />
            </Popover>
            <div className="picker-triangle" />
          </>
        ) : null}
      </React.Suspense>
    </label>
  );
}

import React from "react";
import { Popover } from "./Popover";
import { isTransparent } from "../utils";

import "./ColorPicker.scss";
import { isArrowKey, KEYS } from "../keys";
import { t, getLanguage } from "../i18n";
import { isWritableElement } from "../utils";
import colors from "../colors";
import { ExcalidrawElement } from "../element/types";
import { AppState } from "../types";

const MAX_CUSTOM_COLORS = 5;
const MAX_DEFAULT_COLORS = 15;

export const getCustomColors = (
  elements: readonly ExcalidrawElement[],
  type: "elementBackground" | "elementStroke",
) => {
  const customColors: string[] = [];
  const updatedElements = elements
    .filter((element) => !element.isDeleted)
    .sort((ele1, ele2) => ele2.updated - ele1.updated);

  let index = 0;
  const elementColorTypeMap = {
    elementBackground: "backgroundColor",
    elementStroke: "strokeColor",
  };
  const colorType = elementColorTypeMap[type] as
    | "backgroundColor"
    | "strokeColor";
  while (
    index < updatedElements.length &&
    customColors.length < MAX_CUSTOM_COLORS
  ) {
    const element = updatedElements[index];

    if (
      customColors.length < MAX_CUSTOM_COLORS &&
      isCustomColor(element[colorType], type) &&
      !customColors.includes(element[colorType])
    ) {
      customColors.push(element[colorType]);
    }
    index++;
  }
  return customColors;
};

const isCustomColor = (
  color: string,
  type: "elementBackground" | "elementStroke",
) => {
  return !colors[type].includes(color);
};

const isValidColor = (color: string) => {
  const style = new Option().style;
  style.color = color;
  return !!style.color;
};

const getColor = (color: string): string | null => {
  if (isTransparent(color)) {
    return color;
  }

  return isValidColor(color)
    ? color
    : isValidColor(`#${color}`)
    ? `#${color}`
    : null;
};

// This is a narrow reimplementation of the awesome react-color Twitter component
// https://github.com/casesandberg/react-color/blob/master/src/components/twitter/Twitter.js

// Unfortunately, we can't detect keyboard layout in the browser. So this will
// only work well for QWERTY but not AZERTY or others...
const keyBindings = [
  ["1", "2", "3", "4", "5"],
  ["q", "w", "e", "r", "t"],
  ["a", "s", "d", "f", "g"],
  ["z", "x", "c", "v", "b"],
].flat();

const Picker = ({
  colors,
  color,
  onChange,
  onClose,
  label,
  showInput = true,
  type,
  elements,
}: {
  colors: string[];
  color: string | null;
  onChange: (color: string) => void;
  onClose: () => void;
  label: string;
  showInput: boolean;
  type: "canvasBackground" | "elementBackground" | "elementStroke";
  elements: readonly ExcalidrawElement[];
}) => {
  const firstItem = React.useRef<HTMLButtonElement>();
  const activeItem = React.useRef<HTMLButtonElement>();
  const gallery = React.useRef<HTMLDivElement>();
  const colorInput = React.useRef<HTMLInputElement>();

  const [customColors] = React.useState(() => {
    if (type !== "canvasBackground") {
      return getCustomColors(elements, type);
    }
    return [];
  });

  React.useEffect(() => {
    // After the component is first mounted focus on first input
    if (activeItem.current) {
      activeItem.current.focus();
    } else if (colorInput.current) {
      colorInput.current.focus();
    } else if (gallery.current) {
      gallery.current.focus();
    }
  }, []);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === KEYS.TAB) {
      const { activeElement } = document;
      if (event.shiftKey) {
        if (activeElement === firstItem.current) {
          colorInput.current?.focus();
          event.preventDefault();
        }
      } else if (activeElement === colorInput.current) {
        firstItem.current?.focus();
        event.preventDefault();
      }
    } else if (isArrowKey(event.key)) {
      const { activeElement } = document;
      const isRTL = getLanguage().rtl;
      let isCustom = false;
      let index = Array.prototype.indexOf.call(
        gallery!.current!.querySelector(".color-picker-content--default")!
          .children,
        activeElement,
      );
      if (index === -1) {
        index = Array.prototype.indexOf.call(
          gallery!.current!.querySelector(
            ".color-picker-content--canvas-colors",
          )!.children,
          activeElement,
        );
        if (index !== -1) {
          isCustom = true;
        }
      }
      const parentSelector = isCustom
        ? gallery!.current!.querySelector(
            ".color-picker-content--canvas-colors",
          )!
        : gallery!.current!.querySelector(".color-picker-content--default")!;

      if (index !== -1) {
        const length = parentSelector!.children.length - (showInput ? 1 : 0);
        const nextIndex =
          event.key === (isRTL ? KEYS.ARROW_LEFT : KEYS.ARROW_RIGHT)
            ? (index + 1) % length
            : event.key === (isRTL ? KEYS.ARROW_RIGHT : KEYS.ARROW_LEFT)
            ? (length + index - 1) % length
            : !isCustom && event.key === KEYS.ARROW_DOWN
            ? (index + 5) % length
            : !isCustom && event.key === KEYS.ARROW_UP
            ? (length + index - 5) % length
            : index;
        (parentSelector!.children![nextIndex] as HTMLElement)?.focus();
      }
      event.preventDefault();
    } else if (
      keyBindings.includes(event.key.toLowerCase()) &&
      !isWritableElement(event.target)
    ) {
      const index = keyBindings.indexOf(event.key.toLowerCase());
      const isCustom = index >= MAX_DEFAULT_COLORS;
      const parentSelector = isCustom
        ? gallery!.current!.querySelector(
            ".color-picker-content--canvas-colors",
          )!
        : gallery!.current!.querySelector(".color-picker-content--default")!;
      const actualIndex = isCustom ? index - MAX_DEFAULT_COLORS : index;
      (parentSelector!.children![actualIndex] as HTMLElement)?.focus();

      event.preventDefault();
    } else if (event.key === KEYS.ESCAPE || event.key === KEYS.ENTER) {
      event.preventDefault();
      onClose();
    }
    event.nativeEvent.stopImmediatePropagation();
    event.stopPropagation();
  };

  const renderColors = (colors: Array<string>, custom: boolean = false) => {
    return colors.map((_color, i) => {
      const _colorWithoutHash = _color.replace("#", "");
      const keyBinding = custom
        ? keyBindings[i + MAX_DEFAULT_COLORS]
        : keyBindings[i];
      const label = custom
        ? _colorWithoutHash
        : t(`colors.${_colorWithoutHash}`);
      return (
        <button
          className="color-picker-swatch"
          onClick={(event) => {
            (event.currentTarget as HTMLButtonElement).focus();
            onChange(_color);
          }}
          title={`${label}${
            !isTransparent(_color) ? ` (${_color})` : ""
          } — ${keyBinding.toUpperCase()}`}
          aria-label={label}
          aria-keyshortcuts={keyBindings[i]}
          style={{ color: _color }}
          key={_color}
          ref={(el) => {
            if (!custom && el && i === 0) {
              firstItem.current = el;
            }
            if (el && _color === color) {
              activeItem.current = el;
            }
          }}
          onFocus={() => {
            onChange(_color);
          }}
        >
          {isTransparent(_color) ? (
            <div className="color-picker-transparent"></div>
          ) : undefined}
          <span className="color-picker-keybinding">{keyBinding}</span>
        </button>
      );
    });
  };

  return (
    <div
      className={`color-picker color-picker-type-${type}`}
      role="dialog"
      aria-modal="true"
      aria-label={t("labels.colorPicker")}
      onKeyDown={handleKeyDown}
    >
      <div className="color-picker-triangle color-picker-triangle-shadow"></div>
      <div className="color-picker-triangle"></div>
      <div
        className="color-picker-content"
        ref={(el) => {
          if (el) {
            gallery.current = el;
          }
        }}
        tabIndex={0}
      >
        <div className="color-picker-content--default">
          {renderColors(colors)}
        </div>
        {!!customColors.length && (
          <div className="color-picker-content--canvas">
            <span className="color-picker-content--canvas-title">
              {t("labels.canvasColors")}
            </span>
            <div className="color-picker-content--canvas-colors">
              {renderColors(customColors, true)}
            </div>
          </div>
        )}

        {showInput && (
          <ColorInput
            color={color}
            label={label}
            onChange={(color) => {
              onChange(color);
            }}
            ref={colorInput}
          />
        )}
      </div>
    </div>
  );
};

const ColorInput = React.forwardRef(
  (
    {
      color,
      onChange,
      label,
    }: {
      color: string | null;
      onChange: (color: string) => void;
      label: string;
    },
    ref,
  ) => {
    const [innerValue, setInnerValue] = React.useState(color);
    const inputRef = React.useRef(null);

    React.useEffect(() => {
      setInnerValue(color);
    }, [color]);

    React.useImperativeHandle(ref, () => inputRef.current);

    const changeColor = React.useCallback(
      (inputValue: string) => {
        const value = inputValue.toLowerCase();
        const color = getColor(value);
        if (color) {
          onChange(color);
        }
        setInnerValue(value);
      },
      [onChange],
    );

    return (
      <label className="color-input-container">
        <div className="color-picker-hash">#</div>
        <input
          spellCheck={false}
          className="color-picker-input"
          aria-label={label}
          onChange={(event) => changeColor(event.target.value)}
          value={(innerValue || "").replace(/^#/, "")}
          onBlur={() => setInnerValue(color)}
          ref={inputRef}
        />
      </label>
    );
  },
);

export const ColorPicker = ({
  type,
  color,
  onChange,
  label,
  isActive,
  setActive,
  elements,
  appState,
}: {
  type: "canvasBackground" | "elementBackground" | "elementStroke";
  color: string | null;
  onChange: (color: string) => void;
  label: string;
  isActive: boolean;
  setActive: (active: boolean) => void;
  elements: readonly ExcalidrawElement[];
  appState: AppState;
}) => {
  const pickerButton = React.useRef<HTMLButtonElement>(null);

  return (
    <div>
      <div className="color-picker-control-container">
        <button
          className="color-picker-label-swatch"
          aria-label={label}
          style={color ? { "--swatch-color": color } : undefined}
          onClick={() => setActive(!isActive)}
          ref={pickerButton}
        />
        <ColorInput
          color={color}
          label={label}
          onChange={(color) => {
            onChange(color);
          }}
        />
      </div>
      <React.Suspense fallback="">
        {isActive ? (
          <Popover
            onCloseRequest={(event) =>
              event.target !== pickerButton.current && setActive(false)
            }
          >
            <Picker
              colors={colors[type]}
              color={color || null}
              onChange={(changedColor) => {
                onChange(changedColor);
              }}
              onClose={() => {
                setActive(false);
                pickerButton.current?.focus();
              }}
              label={label}
              showInput={false}
              type={type}
              elements={elements}
            />
          </Popover>
        ) : null}
      </React.Suspense>
    </div>
  );
};

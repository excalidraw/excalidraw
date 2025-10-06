import clsx from "clsx";
import { useCallback, useEffect, useRef, useState } from "react";

import { KEYS } from "@excalidraw/common";

import { t } from "../i18n";

interface CustomFontSizeInputProps {
  value: number | null;
  onChange: (fontSize: number) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  className?: string;
  disabled?: boolean;
}

const MIN_FONT_SIZE = 4;
const MAX_FONT_SIZE = 200;

export const CustomFontSizeInput = ({
  value,
  onChange,
  onFocus,
  onBlur,
  className,
  disabled = false,
}: CustomFontSizeInputProps) => {
  const [inputValue, setInputValue] = useState(value?.toString() || "");
  const [isValid, setIsValid] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setInputValue(value?.toString() || "");
    setIsValid(true);
  }, [value]);

  // Dynamic width calculation based on content
  const getInputWidth = useCallback((text: string) => {
    const length = text.length;
    if (length <= 2) return undefined; // Use min-width from CSS
    if (length === 3) return "3rem";
    return "4rem"; // max-width
  }, []);

  const validateAndApply = useCallback(
    (inputStr: string) => {
      const trimmed = inputStr.trim();
      
      if (!trimmed) {
        setIsValid(false);
        return;
      }

      const parsed = parseFloat(trimmed);
      
      if (isNaN(parsed)) {
        setIsValid(false);
        return;
      }

      if (parsed < MIN_FONT_SIZE || parsed > MAX_FONT_SIZE) {
        setIsValid(false);
        return;
      }

      const rounded = Math.round(parsed);
      setIsValid(true);
      onChange(rounded);
    },
    [onChange],
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === KEYS.ENTER) {
        event.preventDefault();
        validateAndApply(inputValue);
        inputRef.current?.blur();
      } else if (event.key === KEYS.ESCAPE) {
        event.preventDefault();
        setInputValue(value?.toString() || "");
        setIsValid(true);
        inputRef.current?.blur();
      }
    },
    [inputValue, validateAndApply, value],
  );

  const handleBlur = useCallback(() => {
    if (inputValue.trim()) {
      validateAndApply(inputValue);
    } else {
      setInputValue(value?.toString() || "");
      setIsValid(true);
    }
    onBlur?.();
  }, [inputValue, validateAndApply, value, onBlur]);

  const handleFocus = useCallback(
    (event: React.FocusEvent<HTMLInputElement>) => {
      event.target.select();
      onFocus?.();
    },
    [onFocus],
  );

  return (
    <div className={clsx("custom-font-size-input", className)}>
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        value={inputValue}
        onChange={(e) => {
          setInputValue(e.target.value);
          setIsValid(true); // Reset validation state while typing
        }}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        onFocus={handleFocus}
        disabled={disabled}
        className={clsx("custom-font-size-input__field", {
          "custom-font-size-input__field--invalid": !isValid,
        })}
        style={{ width: getInputWidth(inputValue) }}
        placeholder="##"
        title={`Custom font size (${MIN_FONT_SIZE}-${MAX_FONT_SIZE}px)`}
        aria-label="Custom font size"
        autoComplete="off"
        spellCheck={false}
      />
    </div>
  );
};

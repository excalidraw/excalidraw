import { useEffect, useRef } from "react";

import { EVENT, KEYS } from "@excalidraw/common";

import type { ChangeEventHandler } from "react";

interface TTDDialogInputProps {
  input: string;
  placeholder: string;
  onChange: ChangeEventHandler<HTMLTextAreaElement>;
  onKeyboardSubmit?: () => void;
  shortcutType?: "enter" | "ctrlEnter";
}

export const TTDDialogInput = ({
  input,
  placeholder,
  onChange,
  onKeyboardSubmit,
  shortcutType = "enter",
}: TTDDialogInputProps) => {
  const ref = useRef<HTMLTextAreaElement>(null);

  const callbackRef = useRef(onKeyboardSubmit);
  callbackRef.current = onKeyboardSubmit;

  useEffect(() => {
    if (!callbackRef.current) {
      return;
    }
    const textarea = ref.current;
    if (textarea) {
      const handleKeyDown = (event: KeyboardEvent) => {
        if (shortcutType === "ctrlEnter") {
          if (event[KEYS.CTRL_OR_CMD] && event.key === KEYS.ENTER) {
            event.preventDefault();
            callbackRef.current?.();
          }
        } else if (shortcutType === "enter") {
          if (event.key === KEYS.ENTER && !event.shiftKey && !event[KEYS.CTRL_OR_CMD]) {
            event.preventDefault();
            callbackRef.current?.();
          }
        }
      };
      textarea.focus();
      textarea.addEventListener(EVENT.KEYDOWN, handleKeyDown);
      return () => {
        textarea.removeEventListener(EVENT.KEYDOWN, handleKeyDown);
      };
    }
  }, [shortcutType]);

  return (
    <textarea
      className="ttd-dialog-input"
      onChange={onChange}
      value={input}
      placeholder={placeholder}
      ref={ref}
    />
  );
};

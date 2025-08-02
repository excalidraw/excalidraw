import { useEffect, useRef } from "react";

import { EVENT, KEYS } from "@excalidraw/common";

import type { ChangeEventHandler } from "react";

interface TTDDialogInputProps {
  input: string;
  placeholder: string;
  onChange: ChangeEventHandler<HTMLTextAreaElement>;
  onKeyboardSubmit?: () => void;
}

export const TTDDialogInput = ({
  input,
  placeholder,
  onChange,
  onKeyboardSubmit,
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
        if (event[KEYS.CTRL_OR_CMD] && event.key === KEYS.ENTER) {
          event.preventDefault();
          callbackRef.current?.();
        }
      };
      textarea.focus();
      textarea.addEventListener(EVENT.KEYDOWN, handleKeyDown);
      return () => {
        textarea.removeEventListener(EVENT.KEYDOWN, handleKeyDown);
      };
    }
  }, []);

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

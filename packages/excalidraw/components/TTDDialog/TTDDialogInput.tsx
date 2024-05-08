import type { ChangeEventHandler } from "react";
import { useEffect, useRef } from "react";
import { EVENT } from "../../constants";
import { KEYS } from "../../keys";

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
      autoFocus
      ref={ref}
    />
  );
};

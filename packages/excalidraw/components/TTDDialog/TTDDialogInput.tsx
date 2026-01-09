import { useEffect, useRef } from "react";

import { EVENT, KEYS } from "@excalidraw/common";

import { VoiceButton } from "./VoiceButton";

import type { ChangeEventHandler } from "react";

interface TTDDialogInputProps {
  input: string;
  placeholder: string;
  onChange: ChangeEventHandler<HTMLTextAreaElement>;
  onKeyboardSubmit?: () => void;
  onVoiceInput?: (text: string) => void;
  voiceDisabled?: boolean;
}

export const TTDDialogInput = ({
  input,
  placeholder,
  onChange,
  onKeyboardSubmit,
  onVoiceInput,
  voiceDisabled,
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
    <div className="ttd-dialog-input-container">
      <textarea
        className="ttd-dialog-input"
        onChange={onChange}
        value={input}
        placeholder={placeholder}
        ref={ref}
      />
      {onVoiceInput && (
        <VoiceButton onTranscript={onVoiceInput} disabled={voiceDisabled} />
      )}
    </div>
  );
};

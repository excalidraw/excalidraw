import { useEffect, useRef, useState } from "react";

import { EVENT, KEYS } from "@excalidraw/common";

import Spinner from "../Spinner";

import { useUIAppState } from "../../context/ui-appState";

import type { ComponentType } from "react";
import type { CodeMirrorEditorProps } from "./CodeMirrorEditor";

interface TTDDialogInputProps {
  input: string;
  placeholder: string;
  onChange: (value: string) => void;
  onKeyboardSubmit?: () => void;
  errorLine?: number | null;
}

type EditorState =
  | { type: "loading" }
  | { type: "ready"; component: ComponentType<CodeMirrorEditorProps> }
  | { type: "fallback" };

const SPINNER_DELAY_MS = 300;

export const TTDDialogInput = ({
  input,
  placeholder,
  onChange,
  onKeyboardSubmit,
  errorLine,
}: TTDDialogInputProps) => {
  const ref = useRef<HTMLTextAreaElement>(null);

  const callbackRef = useRef(onKeyboardSubmit);
  callbackRef.current = onKeyboardSubmit;

  const [editorState, setEditorState] = useState<EditorState>({
    type: "loading",
  });
  const [showSpinner, setShowSpinner] = useState(false);

  const { theme } = useUIAppState();

  // Lazy-load CodeMirror editor
  useEffect(() => {
    let cancelled = false;

    const spinnerTimer = setTimeout(() => {
      if (!cancelled) {
        setShowSpinner(true);
      }
    }, SPINNER_DELAY_MS);

    import("./CodeMirrorEditor")
      .then((mod) => {
        if (!cancelled) {
          setEditorState({ type: "ready", component: mod.default });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setEditorState({ type: "fallback" });
        }
      })
      .finally(() => {
        clearTimeout(spinnerTimer);
      });

    return () => {
      cancelled = true;
      clearTimeout(spinnerTimer);
    };
  }, []);

  // Keyboard shortcut + focus for textarea fallback
  useEffect(() => {
    if (editorState.type !== "fallback") {
      return;
    }
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
  }, [editorState.type]);

  if (editorState.type === "ready") {
    const CodeMirrorEditor = editorState.component;
    return (
      <CodeMirrorEditor
        value={input}
        onChange={onChange}
        onKeyboardSubmit={onKeyboardSubmit}
        placeholder={placeholder}
        theme={theme}
        errorLine={errorLine}
      />
    );
  }

  if (editorState.type === "fallback") {
    return (
      <textarea
        className="ttd-dialog-input"
        onChange={(e) => onChange(e.target.value)}
        value={input}
        placeholder={placeholder}
        ref={ref}
      />
    );
  }

  // Loading state
  if (showSpinner) {
    return (
      <div className="ttd-dialog-input ttd-dialog-input--loading">
        <Spinner />
      </div>
    );
  }

  return null;
};

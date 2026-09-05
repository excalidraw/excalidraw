import { useCallback, useRef, useState } from "react";
import type { ChangeEvent, FormEvent, KeyboardEvent } from "react";

import RoughBox from "@/components/RoughBox";
import { FIELD_OPTIONS } from "@/config";
import { useDismiss } from "@/hooks/useDismiss";
import type { Attachment } from "@/types";

interface ChatboxProps {
  onSend: (content: string, attachments: Attachment[]) => void;
  disabled?: boolean;
}

/** What the + menu can hang on a message. */
const ATTACH_OPTIONS = [
  { id: "pdf", label: "PDF", accept: "application/pdf" },
  { id: "image", label: "Image", accept: "image/*" },
  { id: "file", label: "Any file", accept: "" },
];

const createId = () =>
  globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);

export function Chatbox({ onSend, disabled = false }: ChatboxProps) {
  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useDismiss(menuRef, useCallback(() => setMenuOpen(false), []), menuOpen);

  const submit = () => {
    const content = draft.trim();
    if ((!content && attachments.length === 0) || disabled) {
      return;
    }

    onSend(content, attachments);
    setDraft("");
    setAttachments([]);
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    submit();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  const pickFiles = (accept: string) => {
    const input = fileRef.current;
    if (!input) {
      return;
    }

    input.accept = accept;
    input.value = "";
    input.click();
    setMenuOpen(false);
  };

  const handleFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(event.target.files ?? []).map((file) => ({
      id: createId(),
      name: file.name,
      type: file.type,
      url: URL.createObjectURL(file),
    }));

    setAttachments((previous) => [...previous, ...picked]);
  };

  const removeAttachment = (id: string) => {
    setAttachments((previous) => {
      const target = previous.find((file) => file.id === id);
      if (target) {
        URL.revokeObjectURL(target.url);
      }
      return previous.filter((file) => file.id !== id);
    });
  };

  return (
    <form className="chatbox" onSubmit={handleSubmit}>
      <div className="chatbox__frame">
        <RoughBox />

        {attachments.length > 0 && (
          <ul className="chatbox__chips">
            {attachments.map((file) => (
              <li key={file.id} className="chatbox__chip">
                <span>{file.name}</span>
                <button
                  type="button"
                  onClick={() => removeAttachment(file.id)}
                  aria-label={`Remove ${file.name}`}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}

        <textarea
          className="chatbox__input"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Send a message…"
          disabled={disabled}
        />

        <div className="chatbox__attach" ref={menuRef}>
          <button
            className="chatbox__plus"
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label="Add an attachment"
            aria-expanded={menuOpen}
            disabled={disabled}
          >
            <RoughBox options={FIELD_OPTIONS} />
            <span>+</span>
          </button>

          {menuOpen && (
            <div className="chatbox__menu">
              <RoughBox options={FIELD_OPTIONS} />
              {ATTACH_OPTIONS.map(({ id, label, accept }) => (
                <button key={id} type="button" onClick={() => pickFiles(accept)}>
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          className="chatbox__send"
          type="submit"
          disabled={disabled || (!draft.trim() && attachments.length === 0)}
        >
          Send
        </button>

        <input
          ref={fileRef}
          className="chatbox__file"
          type="file"
          multiple
          onChange={handleFiles}
        />
      </div>
    </form>
  );
}

export default Chatbox;

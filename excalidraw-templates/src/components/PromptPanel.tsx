import { useState } from "react";
import type { Template } from "../templates/registry";
import "./PromptPanel.css";

interface PromptPanelProps {
  template: Template;
  isSubmitting: boolean;
  onSubmit: (prompt: string) => void;
  onCancel: () => void;
}

export function PromptPanel({
  template,
  isSubmitting,
  onSubmit,
  onCancel,
}: PromptPanelProps) {
  const [value, setValue] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || isSubmitting) return;
    onSubmit(trimmed);
  };

  return (
    <div className="prompt-panel">
      <form className="prompt-panel__form" onSubmit={handleSubmit}>
        <label className="prompt-panel__label" htmlFor="prompt-panel-input">
          {template.label} — {template.hint}
        </label>
        <input
          id="prompt-panel-input"
          className="prompt-panel__input"
          type="text"
          maxLength={300}
          placeholder={template.placeholder}
          value={value}
          autoFocus
          disabled={isSubmitting}
          onChange={(e) => setValue(e.target.value)}
        />
        <div className="prompt-panel__actions">
          <button
            type="button"
            className="prompt-panel__cancel"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="prompt-panel__submit"
            disabled={isSubmitting || value.trim().length === 0}
          >
            {isSubmitting ? "Generating…" : "Generate"}
          </button>
        </div>
      </form>
    </div>
  );
}

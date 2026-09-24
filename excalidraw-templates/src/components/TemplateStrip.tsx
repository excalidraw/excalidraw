import { useEffect, useState } from "react";
import type { Template } from "../templates/registry";
import { templates } from "../templates/registry";
import { markStripShown } from "../lib/events";
import "./TemplateStrip.css";

interface TemplateStripProps {
  /**
   * Whether the canvas currently has zero elements. Computed by the parent
   * from Excalidraw's real `onChange` callback — this component never
   * polls the scene itself.
   */
  isSceneEmpty: boolean;
  onSelectTemplate: (template: Template) => void;
}

function TemplateIcon({ id }: { id: Template["id"] }) {
  switch (id) {
    case "flowchart":
      return (
        <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
          <rect x="9" y="1" width="10" height="6" rx="1" fill="none" stroke="currentColor" />
          <path d="M14 10 L19 14 L14 18 L9 14 Z" fill="none" stroke="currentColor" />
          <rect x="9" y="21" width="10" height="6" rx="1" fill="none" stroke="currentColor" />
          <path d="M14 7 V10 M14 18 V21" stroke="currentColor" />
        </svg>
      );
    case "process":
      return (
        <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
          <rect x="1" y="11" width="6" height="6" fill="none" stroke="currentColor" />
          <rect x="11" y="11" width="6" height="6" fill="none" stroke="currentColor" />
          <rect x="21" y="11" width="6" height="6" fill="none" stroke="currentColor" />
          <path d="M7 14 H11 M17 14 H21" stroke="currentColor" markerEnd="url(#arrow)" />
        </svg>
      );
    case "org":
      return (
        <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
          <rect x="9" y="1" width="10" height="6" rx="1" fill="none" stroke="currentColor" />
          <rect x="1" y="21" width="9" height="6" rx="1" fill="none" stroke="currentColor" />
          <rect x="18" y="21" width="9" height="6" rx="1" fill="none" stroke="currentColor" />
          <path d="M14 7 V14 H5.5 V21 M14 14 H22.5 V21" fill="none" stroke="currentColor" />
        </svg>
      );
    case "mindmap":
      return (
        <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
          <circle cx="14" cy="14" r="4" fill="none" stroke="currentColor" />
          <circle cx="4" cy="4" r="2.5" fill="none" stroke="currentColor" />
          <circle cx="24" cy="4" r="2.5" fill="none" stroke="currentColor" />
          <circle cx="14" cy="25" r="2.5" fill="none" stroke="currentColor" />
          <path
            d="M11.5 11.5 L6 6 M16.5 11.5 L22 6 M14 18 V22.5"
            stroke="currentColor"
          />
        </svg>
      );
    default:
      return null;
  }
}

export function TemplateStrip({
  isSceneEmpty,
  onSelectTemplate,
}: TemplateStripProps) {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!isSceneEmpty || dismissed) return;
    markStripShown();
  }, [isSceneEmpty, dismissed]);

  useEffect(() => {
    if (!isSceneEmpty || dismissed) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDismissed(true);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSceneEmpty, dismissed]);

  if (!isSceneEmpty || dismissed) return null;

  return (
    <div className="template-strip">
      <div className="template-strip__grid">
        {templates.map((template) => (
          <button
            key={template.id}
            type="button"
            className="template-strip__button"
            onClick={() => onSelectTemplate(template)}
          >
            <TemplateIcon id={template.id} />
            <span className="template-strip__label">{template.label}</span>
            <span className="template-strip__hint">{template.hint}</span>
          </button>
        ))}
      </div>
      <button
        type="button"
        className="template-strip__dismiss"
        onClick={() => setDismissed(true)}
      >
        or start blank
      </button>
    </div>
  );
}

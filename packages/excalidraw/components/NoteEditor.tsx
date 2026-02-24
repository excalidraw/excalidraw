import React, { useState, useRef, useEffect } from "react";

import clsx from "clsx";

import { FONT_FAMILY, TEXT_ALIGN } from "@excalidraw/common";

import type { ExcalidrawTextElement } from "@excalidraw/element/types";

import { t } from "../i18n";

import { Popover } from "./Popover";
import { TrashIcon, CloseIcon, checkIcon } from "./icons";

import "./NoteEditor.scss";

import type { UIAppState } from "../types";

interface NoteEditorProps {
  textElement: ExcalidrawTextElement;
  appState: UIAppState;
  onSave: (noteData: NonNullable<ExcalidrawTextElement["note"]>) => void;
  onCancel: () => void;
  onDelete?: () => void;
}

export const NoteEditor: React.FC<NoteEditorProps> = ({
  textElement,
  appState,
  onSave,
  onCancel,
  onDelete,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const existingNote = textElement.note;

  const [noteContent, setNoteContent] = useState(existingNote?.content || "");

  const [formatting, setFormatting] = useState(
    existingNote?.formatting || {
      fontSize: 12,
      fontFamily: textElement.fontFamily,
      textAlign: textElement.textAlign,
      strokeColor: textElement.strokeColor,
      backgroundColor: "transparent",
      bold: false,
      italic: false,
    },
  );

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, []);

  const handleSave = () => {
    if (noteContent.trim()) {
      const noteData: NonNullable<ExcalidrawTextElement["note"]> = {
        id:
          existingNote?.id ||
          `note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        content: noteContent.trim(),
        isVisible: false,
        formatting,
      };
      onSave(noteData);
    } else {
      onCancel();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      handleSave();
    } else if (e.key === "Escape") {
      onCancel();
    }
  };

  const updateFormatting = (updates: Partial<typeof formatting>) => {
    setFormatting((prev: typeof formatting) => ({ ...prev, ...updates }));
  };

  return (
    <Popover onCloseRequest={onCancel} className="note-editor-popover">
      <div className="note-editor">
        <div className="note-editor__header">
          <h3 className="note-editor__title">
            {existingNote ? t("labels.editNote") : t("labels.addNote")}
          </h3>
        </div>

        <div className="note-editor__content">
          <textarea
            ref={textareaRef}
            className="note-editor__textarea"
            value={noteContent}
            onChange={(e) => setNoteContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("labels.noteContentPlaceholder")}
            rows={4}
            style={{
              fontSize: `${formatting.fontSize}px`,
              fontFamily:
                Object.entries(FONT_FAMILY).find(
                  ([, value]) => value === formatting.fontFamily,
                )?.[0] || "Arial",
              textAlign:
                formatting.textAlign as React.CSSProperties["textAlign"],
              color: formatting.strokeColor,
              backgroundColor: formatting.backgroundColor,
              fontWeight: formatting.bold ? "bold" : "normal",
              fontStyle: formatting.italic ? "italic" : "normal",
            }}
          />
        </div>

        <div className="note-editor__formatting">
          <div className="note-editor__formatting-row">
            <label className="note-editor__label">{t("labels.fontSize")}</label>
            <input
              type="number"
              className="note-editor__font-size-input"
              value={formatting.fontSize}
              onChange={(e) =>
                updateFormatting({ fontSize: parseInt(e.target.value) || 16 })
              }
              min="8"
              max="72"
            />
          </div>

          <div className="note-editor__formatting-row">
            <label className="note-editor__label">
              {t("labels.fontFamily")}
            </label>
            <select
              className="note-editor__select"
              value={formatting.fontFamily}
              onChange={(e) =>
                updateFormatting({
                  fontFamily: parseInt(e.target.value) as any,
                })
              }
            >
              {Object.entries(FONT_FAMILY).map(([key, value]) => (
                <option key={key} value={value}>
                  {key}
                </option>
              ))}
            </select>
          </div>

          <div className="note-editor__formatting-row">
            <label className="note-editor__label">
              {t("labels.textAlign")}
            </label>
            <select
              className="note-editor__select"
              value={formatting.textAlign}
              onChange={(e) =>
                updateFormatting({ textAlign: e.target.value as any })
              }
            >
              <option value={TEXT_ALIGN.LEFT}>Left</option>
              <option value={TEXT_ALIGN.CENTER}>Center</option>
              <option value={TEXT_ALIGN.RIGHT}>Right</option>
            </select>
          </div>

          <div className="note-editor__formatting-row">
            <label className="note-editor__label">
              {t("labels.changeStroke")}
            </label>
            <input
              type="color"
              className="note-editor__color-input"
              value={formatting.strokeColor}
              onChange={(e) =>
                updateFormatting({ strokeColor: e.target.value })
              }
            />
          </div>

          <div className="note-editor__formatting-row">
            <label className="note-editor__label">
              {t("labels.changeBackground")}
            </label>
            <input
              type="color"
              className="note-editor__color-input"
              value={
                formatting.backgroundColor === "transparent"
                  ? "#ffffff"
                  : formatting.backgroundColor
              }
              onChange={(e) =>
                updateFormatting({ backgroundColor: e.target.value })
              }
            />
          </div>

          <div className="note-editor__formatting-row">
            <div className="note-editor__style-buttons">
              <button
                type="button"
                className={clsx("note-editor__style-button", {
                  "note-editor__style-button--active": formatting.bold,
                })}
                onClick={() => updateFormatting({ bold: !formatting.bold })}
              >
                <strong>B</strong>
              </button>
              <button
                type="button"
                className={clsx("note-editor__style-button", {
                  "note-editor__style-button--active": formatting.italic,
                })}
                onClick={() => updateFormatting({ italic: !formatting.italic })}
              >
                <em>I</em>
              </button>
            </div>
          </div>
        </div>

        <div className="note-editor__actions">
          {existingNote && onDelete && (
            <button
              type="button"
              className="note-editor__icon-button note-editor__icon-button--danger"
              onClick={onDelete}
              title={t("labels.deleteNote")}
              aria-label={t("labels.deleteNote")}
            >
              {TrashIcon}
            </button>
          )}
          <div className="note-editor__primary-actions">
            <button
              type="button"
              className="note-editor__icon-button note-editor__icon-button--secondary"
              onClick={onCancel}
              title={t("buttons.cancel")}
              aria-label={t("buttons.cancel")}
            >
              {CloseIcon}
            </button>
            <button
              type="button"
              className="note-editor__icon-button note-editor__icon-button--primary"
              onClick={handleSave}
              disabled={!noteContent.trim()}
              title={existingNote ? t("buttons.save") : t("labels.addNote")}
              aria-label={
                existingNote ? t("buttons.save") : t("labels.addNote")
              }
            >
              {checkIcon}
            </button>
          </div>
        </div>
      </div>
    </Popover>
  );
};

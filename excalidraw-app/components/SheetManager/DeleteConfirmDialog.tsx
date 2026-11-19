import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";

interface DeleteConfirmDialogProps {
  isOpen: boolean;
  sheetTitle: string;
  isOnlySheet: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  isDark?: boolean;
}

export const DeleteConfirmDialog: React.FC<DeleteConfirmDialogProps> = ({
  isOpen,
  sheetTitle,
  isOnlySheet,
  onConfirm,
  onCancel,
  isDark,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const deleteBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const doc = dialogRef.current?.ownerDocument || document;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCancel();
      }
    };

    doc.addEventListener("keydown", handleKeyDown);
    deleteBtnRef.current?.focus();

    return () => {
      doc.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onCancel]);

  if (!isOpen) {
    return null;
  }

  const doc = document;

  return createPortal(
    <div className={clsx("excalidraw", { "theme--dark": isDark })}>
      <div
        className="sheet-dialog-overlay"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            onCancel();
          }
        }}
      >
        <div
          className="sheet-dialog"
          ref={dialogRef}
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="sheet-dialog-title"
          aria-describedby="sheet-dialog-description"
        >
          <h3 id="sheet-dialog-title" className="sheet-dialog__title">
            Delete Sheet
          </h3>
          <p
            id="sheet-dialog-description"
            className="sheet-dialog__description"
          >
            {isOnlySheet
              ? `Are you sure you want to delete "${sheetTitle}"? This will clear the canvas and reset to a fresh blank sheet.`
              : `Are you sure you want to delete "${sheetTitle}"? This action cannot be undone.`}
          </p>
          <div className="sheet-dialog__actions">
            <button
              type="button"
              className="sheet-dialog__btn sheet-dialog__btn--cancel"
              onClick={onCancel}
            >
              Cancel
            </button>
            <button
              type="button"
              ref={deleteBtnRef}
              className="sheet-dialog__btn sheet-dialog__btn--danger"
              onClick={onConfirm}
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>,
    doc.body,
  );
};

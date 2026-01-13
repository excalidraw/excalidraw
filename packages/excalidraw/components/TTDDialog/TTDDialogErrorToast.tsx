import { useEffect } from "react";

import { CloseIcon } from "../icons";

import "./TTDDialogErrorToast.scss";

interface TTDDialogErrorToastProps {
  isOpen: boolean;
  message: string;
  onClose: () => void;
  autoHideDuration?: number;
}

export const TTDDialogErrorToast = ({
  isOpen,
  message,
  onClose,
  autoHideDuration = 5000,
}: TTDDialogErrorToastProps) => {
  // Auto-hide after duration
  useEffect(() => {
    if (!isOpen || !autoHideDuration) {
      return;
    }

    const timer = setTimeout(() => {
      onClose();
    }, autoHideDuration);

    return () => clearTimeout(timer);
  }, [isOpen, autoHideDuration, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="ttd-dialog-error-toast">
      <span className="ttd-dialog-error-toast__icon">⚠️</span>
      <span className="ttd-dialog-error-toast__message">{message}</span>
      <button
        onClick={onClose}
        className="ttd-dialog-error-toast__close"
        aria-label="Close error"
        type="button"
      >
        {CloseIcon}
      </button>
    </div>
  );
};

import { CloseIcon } from "../icons";

import "./TTDDialogErrorBanner.scss";

interface TTDDialogErrorBannerProps {
  message: string;
  onClose: () => void;
}

export const TTDDialogErrorBanner = ({
  message,
  onClose,
}: TTDDialogErrorBannerProps) => {
  return (
    <div className="ttd-dialog-error-banner">
      <span className="ttd-dialog-error-banner__message">{message}</span>
      <button
        onClick={onClose}
        className="ttd-dialog-error-banner__close"
        aria-label="Close error"
        type="button"
      >
        {CloseIcon}
      </button>
    </div>
  );
};

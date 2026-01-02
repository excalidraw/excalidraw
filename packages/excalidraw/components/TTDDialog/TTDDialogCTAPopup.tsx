import { useEffect } from "react";

import { Button } from "../Button";
import { CloseIcon } from "../icons";
import { t } from "../../i18n";

import "./TTDDialogCTAPopup.scss";

interface TTDDialogCTAPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onExploreClick?: () => void;
  onFreeTrialClick?: () => void;
}

export const TTDDialogCTAPopup = ({
  isOpen,
  onClose,
  onExploreClick,
  onFreeTrialClick,
}: TTDDialogCTAPopupProps) => {
  // Close on Escape key
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="ttd-dialog-cta-popup-overlay" onClick={onClose}>
      <div
        className="ttd-dialog-cta-popup"
        onClick={(e) => e.stopPropagation()}
      >
        <Button
          className="ttd-dialog-cta-popup__close"
          onSelect={onClose}
          aria-label={t("buttons.close")}
        >
          {CloseIcon}
        </Button>
        <div className="ttd-dialog-cta-popup__content">
          <h3 className="ttd-dialog-cta-popup__title">
            Daily limit reached
          </h3>
          <p className="ttd-dialog-cta-popup__text">
            You've used all your free AI generations for today. Upgrade to
            Excalidraw+ for more generations and other awesome features!
          </p>
          <div className="ttd-dialog-cta-popup__buttons">
            <button
              className="ttd-dialog-cta-popup__button ttd-dialog-cta-popup__button--explore"
              onClick={() => {
                onExploreClick?.();
                onClose();
              }}
            >
              Explore Excalidraw+
            </button>
            <button
              className="ttd-dialog-cta-popup__button ttd-dialog-cta-popup__button--trial"
              onClick={() => {
                onFreeTrialClick?.();
                onClose();
              }}
            >
              Start 14 Day Free Trial
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

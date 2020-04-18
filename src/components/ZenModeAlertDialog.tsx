import React from "react";
import { Dialog } from "./Dialog";

import { t } from "../i18n";

import "./ZenModeAlertDialog.scss";

type Props = {
  onClose: () => void;
  onContinue: () => void;
  onExit: () => void;
};
const ZenModeAlertDialog = (props: Props) => {
  const { onClose, onContinue, onExit } = props;
  return (
    <Dialog
      onCloseRequest={onClose}
      title={t("zenModeAlertDialog.title")}
      maxWidth={500}
      className="zen-mode-alert"
    >
      <div>
        {t("zenModeAlertDialog.content")}
        <div className="zen-mode-alert__footer">
          <button
            className="zen-mode-alert__footer--continue btn"
            onClick={onContinue}
          >
            {t("zenModeAlertDialog.btn.continue")}
          </button>

          <button className="zen-mode-alert__footer--exit btn" onClick={onExit}>
            {t("zenModeAlertDialog.btn.exit")}
          </button>
        </div>
      </div>
    </Dialog>
  );
};

export default ZenModeAlertDialog;

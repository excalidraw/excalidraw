import React from "react";
import { t } from "../i18n";

export const LoadingMessage = () => {
  // !! KEEP THIS IN SYNC WITH index.html !!
  return (
    <div className="LoadingMessage">
      <span>{t("labels.loadingScene")}</span>
    </div>
  );
};

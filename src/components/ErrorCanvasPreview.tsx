import React from "react";
import { t } from "../i18n";

export const ErrorCanvasPreview = () => {
  return (
    <div>
      <h3>{t("errorCanvasPreview.title")}</h3>
      <p>
        <span>{t("errorCanvasPreview.desc_cannotExportPNG")}</span>
        <br />
        <span>{t("errorCanvasPreview.desc_mightExportSVG")}</span>
      </p>
      <hr />
      <em>{t("errorCanvasPreview.tip")}</em>
    </div>
  );
};

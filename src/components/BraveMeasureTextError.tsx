import { t } from "../i18n";
const BraveMeasureTextError = () => {
  return (
    <div data-testid="brave-measure-text-error">
      <p>
        {t("errors.brave_measure_text_error.start")} &nbsp;
        <span style={{ fontWeight: 600 }}>
          {t("errors.brave_measure_text_error.aggressive_block_fingerprint")}
        </span>{" "}
        {t("errors.brave_measure_text_error.setting_enabled")}.
        <br />
        <br />
        {t("errors.brave_measure_text_error.break")}{" "}
        <span style={{ fontWeight: 600 }}>
          {t("errors.brave_measure_text_error.text_elements")}
        </span>{" "}
        {t("errors.brave_measure_text_error.in_your_drawings")}.
      </p>
      <p>
        {t("errors.brave_measure_text_error.strongly_recommend")}{" "}
        <a href="http://docs.excalidraw.com/docs/@excalidraw/excalidraw/faq#turning-off-aggresive-block-fingerprinting-in-brave-browser">
          {" "}
          {t("errors.brave_measure_text_error.steps")}
        </a>{" "}
        {t("errors.brave_measure_text_error.how")}.
      </p>
      <p>
        {t("errors.brave_measure_text_error.disable_setting")}{" "}
        <a href="https://github.com/excalidraw/excalidraw/issues/new">
          {t("errors.brave_measure_text_error.issue")}
        </a>{" "}
        {t("errors.brave_measure_text_error.write")}{" "}
        <a href="https://discord.gg/UexuTaE">
          {t("errors.brave_measure_text_error.discord")}
        </a>
        .
      </p>
    </div>
  );
};

export default BraveMeasureTextError;

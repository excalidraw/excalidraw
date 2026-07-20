import { t } from "../../../i18n";
import { FilledButton } from "../../FilledButton";

import type { AIRateLimitWarningDescriptor } from "../../../aiWarnings";

export const TTDRateLimitWarningContent = ({
  warning,
  onUpgrade,
}: {
  warning: AIRateLimitWarningDescriptor;
  onUpgrade?: () => void;
}) => {
  if (warning.variant === "messageLimitExceeded") {
    return (
      <>
        {onUpgrade
          ? t("chat.rateLimit.messageLimitWithUpgrade")
          : t("chat.rateLimit.messageLimit")}
        {onUpgrade && (
          <div style={{ marginTop: "10px" }}>
            <FilledButton onClick={onUpgrade}>
              {t("chat.upsellBtnLabel")}
            </FilledButton>
          </div>
        )}
      </>
    );
  }

  return <>{t("chat.rateLimit.generalRateLimit")}</>;
};

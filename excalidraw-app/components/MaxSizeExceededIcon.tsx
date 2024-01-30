import { alert } from "../../packages/excalidraw/components/icons";
import { Tooltip } from "../../packages/excalidraw/components/Tooltip";
import { useI18n } from "../../packages/excalidraw/i18n";

export const MaxSizeExceededIcon = () => {
  const { t } = useI18n();

  return (
    <div className="max-size-exceeded-icon tooltip">
      <Tooltip label={t("errors.collabSaveFailed_sizeExceeded")} long={true}>
        {alert}
      </Tooltip>
    </div>
  );
};

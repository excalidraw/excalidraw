import { shield } from "@excalidraw/excalidraw/components/icons";
import { Tooltip } from "@excalidraw/excalidraw/components/Tooltip";
import { useI18n } from "@excalidraw/excalidraw/i18n";

export const EncryptedIcon = () => {
  const { t } = useI18n();

  return (
    <a
      className="encrypted-icon tooltip"
      href="https://plus.excalidraw.com/blog/end-to-end-encryption"
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t("encrypted.link")}
    >
      <Tooltip label={t("encrypted.tooltip")} long={true}>
        {shield}
      </Tooltip>
    </a>
  );
};

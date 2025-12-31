import { Tooltip } from "@excalidraw-modify/excalidraw/components/Tooltip";
import { shield } from "@excalidraw-modify/excalidraw/components/icons";
import { useI18n } from "@excalidraw-modify/excalidraw/i18n";

export const EncryptedIcon = () => {
  const { t } = useI18n();

  return (
    <a
      className="encrypted-icon tooltip"
      href="https://plus.excalidraw.com/blog/end-to-end-encryption"
      target="_blank"
      rel="noopener"
      aria-label={t("encrypted.link")}
    >
      <Tooltip label={t("encrypted.tooltip")} long={true}>
        {shield}
      </Tooltip>
    </a>
  );
};

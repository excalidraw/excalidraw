import { shield } from "../../components/icons";
import { Tooltip } from "../../components/Tooltip";
import { t } from "../../i18n";

export const EncryptedIcon = () => (
  <a
    className="encrypted-icon tooltip"
    href="https://blog.excalidraw.com/end-to-end-encryption/"
    target="_blank"
    rel="noopener noreferrer"
    aria-label={t("encrypted.link")}
  >
    <Tooltip label={t("encrypted.tooltip")} long={true}>
      {shield}
    </Tooltip>
  </a>
);

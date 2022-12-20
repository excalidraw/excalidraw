import { shield } from "../../components/icons";
import { Tooltip } from "../../components/Tooltip";
import { isExcalidrawPlusSignedUser } from "../../constants";
import { t } from "../../i18n";

const ExcalidrawPlusAppLink = () => {
  if (!isExcalidrawPlusSignedUser) {
    return null;
  }
  return (
    <a
      href={`${process.env.REACT_APP_PLUS_APP}?utm_source=excalidraw&utm_medium=app&utm_content=signedInUserRedirectButton#excalidraw-redirect`}
      target="_blank"
      rel="noreferrer"
      className="plus-button"
    >
      Go to Excalidraw+
    </a>
  );
};

const EncryptedIcon = () => (
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

export const AppFooter = () => {
  return (
    <div style={{ display: "flex", gap: ".5rem", alignItems: "center" }}>
      <ExcalidrawPlusAppLink />
      <EncryptedIcon />
    </div>
  );
};

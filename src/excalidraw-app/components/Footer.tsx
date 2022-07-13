import { isExcalidrawPlusSignedUser, PlusAppLinkJSX, PlusLPLinkJSX } from "..";
import { useDevice } from "../../components/App";
import { shield } from "../../components/icons";
import { Tooltip } from "../../components/Tooltip";
import { t } from "../../i18n";
import { languages } from "../../packages/excalidraw/index";
import { LanguageList } from "./LanguageList";

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

const Footer = ({
  langCode,
  onLangChange,
}: {
  langCode: string;
  onLangChange: (langCode: string) => void;
}) => {
  const device = useDevice();
  if (device.isMobile) {
    const isTinyDevice = window.innerWidth < 362;
    return (
      <div
        style={{
          display: "flex",
          flexDirection: isTinyDevice ? "column" : "row",
        }}
      >
        <fieldset>
          <legend>{t("labels.language")}</legend>
          <LanguageList
            onChange={onLangChange}
            languages={languages}
            currentLangCode={langCode}
          />
        </fieldset>
        {/* FIXME remove after 2021-05-20 */}
        <div
          style={{
            width: "24ch",
            fontSize: "0.7em",
            textAlign: "center",
            marginTop: isTinyDevice ? 16 : undefined,
            marginLeft: "auto",
            marginRight: isTinyDevice ? "auto" : undefined,
            padding: isExcalidrawPlusSignedUser ? undefined : "4px 2px",
            border: isExcalidrawPlusSignedUser ? undefined : "1px dashed #aaa",
            borderRadius: 12,
          }}
        >
          {isExcalidrawPlusSignedUser ? PlusAppLinkJSX : PlusLPLinkJSX}
        </div>
      </div>
    );
  }
  return (
    <>
      <EncryptedIcon />
      <LanguageList
        onChange={onLangChange}
        languages={languages}
        currentLangCode={langCode}
      />
    </>
  );
};

export default Footer;

import React from "react";
import { useTranslation } from "react-i18next";

import { ToolButton } from "./ToolButton";

import { copy } from "./icons";

const defaultUrlElementRef: HTMLInputElement | undefined = undefined;

export function CopyExportUrlInput({
  fetching = false,
  url = "",
}: {
  fetching: boolean;
  url: string;
}) {
  const urlElement = React.useRef(defaultUrlElementRef);
  const { t } = useTranslation();
  const [wasCopy, setWasCopy] = React.useState(false);

  const copyHandler = () => {
    const url = document.getElementById("urlToCopy") as HTMLInputElement;
    const tryExecCommand = () => {
      try {
        url.select();
        document.execCommand("copy");
        setWasCopy(true);
      } catch (err) {
        window.alert(t("alerts.couldNotCopyToClipboard"));
      }
    };
    if (url) {
      urlElement.current = url;
      try {
        navigator.clipboard.writeText(url.value);
        setWasCopy(true);
      } catch (err) {
        tryExecCommand();
      }
    }
  };

  React.useEffect(() => {
    if (wasCopy && urlElement.current) {
      urlElement.current.focus();
      window.alert(t("alerts.urlCopiedClipboardSuccess"));
    }
    return () => {
      setWasCopy(false);
    };
  }, [wasCopy, t, urlElement]);

  return (
    <div className="copyExportUrlWrapper">
      <input
        readOnly
        className="copyExportUrlInput"
        type="text"
        id="urlToCopy"
        value={!fetching ? url : t("labels.loading").toString()}
      />
      <ToolButton
        disabled={fetching}
        type="button"
        icon={copy}
        title={t("buttons.copyToClipboard")}
        aria-label={t("buttons.copyToClipboard")}
        onClick={copyHandler}
      />
    </div>
  );
}

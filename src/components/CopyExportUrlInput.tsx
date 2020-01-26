import React from "react";
import { useTranslation } from "react-i18next";

import { clipboard } from "./icons";

export function CopyExportUrlInput({
  fetching = false,
  url = "",
}: {
  fetching: boolean;
  url: string;
}) {
  const { t } = useTranslation();
  const [wasCopy, setWasCopy] = React.useState(false);
  const copyHandler = (e: any) => {
    const url = document.getElementById("urlToCopy") as HTMLInputElement;
    if (url) {
      navigator.clipboard.writeText(url.value);
      setWasCopy(true);
    }
    e.preventDefault();
  };

  React.useEffect(() => {
    if (wasCopy) {
      window.alert(t("alerts.urlCopiedClipboardSuccess"));
    }
    return () => {
      setWasCopy(false);
    };
  }, [wasCopy, t]);

  return (
    <div className="copyExportUrlWrapper">
      <input
        readOnly
        className="copyExportUrlInput"
        type="text"
        id="urlToCopy"
        value={!fetching ? url : t("labels.loading").toString()}
      />
      <button
        className="ToolIcon_type_button ToolIcon ToolIcon_size_m"
        disabled={fetching}
        onClick={copyHandler}
        id="copyClipboardButton"
      >
        <div className="ToolIcon__icon" aria-hidden="true">
          {clipboard}
        </div>
      </button>
    </div>
  );
}

import React from "react";
// import { t } from "../i18n";

import { ToolButton } from "./ToolButton";

import { copy } from "./icons";

const defaultUrlElementRef: HTMLInputElement | undefined = undefined;

export function CopyExportUrlInput({ url = "" }: { url: string }) {
  const urlElement = React.useRef(defaultUrlElementRef);
  const [wasCopy, setWasCopy] = React.useState(false);

  const copyHandler = () => {
    const url = document.getElementById("urlToCopy") as HTMLInputElement;
    const tryExecCommand = () => {
      try {
        url.select();
        document.execCommand("copy");
        setWasCopy(true);
      } catch (err) {
        window.alert("couldNotCopyToClipboard");
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
      window.alert("rlCopiedClipboardSuccess");
    }
    return () => {
      setWasCopy(false);
    };
  }, [wasCopy, urlElement]);

  return (
    <div className="copyExportUrlWrapper">
      <input
        readOnly
        className="copyExportUrlInput"
        type="text"
        id="urlToCopy"
        value={url}
      />
      <ToolButton
        type="button"
        icon={copy}
        title="copyToClipboard"
        aria-label="copyToClipboard"
        onClick={copyHandler}
      />
    </div>
  );
}

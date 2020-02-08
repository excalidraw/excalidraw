import "./CopyExportUrlInput.css";

import React from "react";
// import { t } from "../i18n";

import { ToolButton } from "./ToolButton";

import { copy } from "./icons";

const defaultUrlElementRef: HTMLInputElement | null = null;

export function CopyExportUrlInput({ url = "" }: { url: string }) {
  const urlInput = React.useRef(defaultUrlElementRef);
  const [wasCopy, setWasCopy] = React.useState(false);

  const copyHandler = () => {
    if (urlInput.current) {
      try {
        urlInput.current.select();
        document.execCommand("copy");
        setWasCopy(true);
      } catch (err) {
        window.alert("couldNotCopyToClipboard");
      }
    }
  };

  React.useEffect(() => {
    if (wasCopy && urlInput.current) {
      urlInput.current.focus();
      window.alert("CopiedClipboardSuccess");
    }
  }, [wasCopy]);

  return (
    <span className="copyUrlInputWrapper">
      <input
        readOnly
        className="copyUrlInput"
        type="text"
        id="urlToCopy"
        ref={urlInput}
        value={url}
      />
      <ToolButton
        type="button"
        icon={copy}
        title="copyToClipboard"
        aria-label="copyToClipboard"
        onClick={copyHandler}
      />
    </span>
  );
}

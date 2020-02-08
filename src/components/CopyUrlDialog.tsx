import "./CopyUrlDialog.css";

import React, { useRef, useState, useEffect } from "react";
import { Modal } from "./Modal";
import { t } from "../i18n";
import { Island } from "./Island";

import { ToolButton } from "./ToolButton";

import { copy } from "./icons";

export function CopyUrlDialog({
  url = null,
  showDialog = false,
  onClose = () => {},
}: {
  url?: string | null;
  onClose?: () => void;
  showDialog?: boolean;
}) {
  const urlInput = useRef<HTMLInputElement>(null);
  const [wasCopy, setWasCopy] = useState(false);
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    urlInput.current?.focus();
  });

  const copyHandler = () => {
    try {
      urlInput.current?.select();
      document.execCommand("copy");
      setWasCopy(true);
    } catch (err) {
      window.alert(t("alerts.couldNotCopyToClipboard"));
    }
  };

  React.useEffect(() => {
    if (wasCopy) {
      urlInput.current?.focus();
    }
  }, [wasCopy]);

  const handleClose = () => {
    onClose();
  };

  return (
    <>
      {showDialog && (
        <Modal
          maxWidth={600}
          onCloseRequest={handleClose}
          labelledBy="copyurl-title"
        >
          <div className="CopyUrlDialog__dialog">
            <Island padding={4}>
              <button
                className="CopyUrlDialog__close"
                onClick={handleClose}
                aria-label={t("buttons.close")}
                ref={closeButton}
              >
                ╳
              </button>
              <p>{t("alerts.uploadedSecurly")}</p>
              <div className="copyUrlInputWrapper">
                <input
                  readOnly
                  className="copyUrlInput"
                  type="text"
                  id="urlToCopy"
                  ref={urlInput}
                  value={url !== null ? url : ""}
                />
                <ToolButton
                  type="button"
                  icon={copy}
                  title="copyToClipboard"
                  aria-label="copyToClipboard"
                  onClick={copyHandler}
                />
              </div>
            </Island>
          </div>
        </Modal>
      )}
    </>
  );
}

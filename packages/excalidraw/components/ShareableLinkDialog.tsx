import { useRef } from "react";

import { copyTextToSystemClipboard } from "../clipboard";
import { useCopyStatus } from "../hooks/useCopiedIndicator";
import { useI18n } from "../i18n";

import { Dialog } from "./Dialog";
import { FilledButton } from "./FilledButton";
import { TextField } from "./TextField";
import { copyIcon } from "./icons";

import "./ShareableLinkDialog.scss";

export type ShareableLinkDialogProps = {
  link: string;

  onCloseRequest: () => void;
  setErrorMessage: (error: string) => void;
};

export const ShareableLinkDialog = ({
  link,
  onCloseRequest,
  setErrorMessage,
}: ShareableLinkDialogProps) => {
  const { t } = useI18n();
  const ref = useRef<HTMLInputElement>(null);
  const { onCopy, copyStatus } = useCopyStatus();

  const copyRoomLink = async () => {
    try {
      await copyTextToSystemClipboard(link);
      onCopy();
    } catch (e) {
      setErrorMessage(t("errors.copyToSystemClipboardFailed"));
    }
    ref.current?.select();
  };
  return (
    <Dialog onCloseRequest={onCloseRequest} title={false} size="small">
      <div className="ShareableLinkDialog">
        <h3>Shareable link</h3>
        <div className="ShareableLinkDialog__linkRow">
          <TextField
            ref={ref}
            label="Link"
            readonly
            fullWidth
            value={link}
            selectOnRender
          />
          <FilledButton
            size="large"
            label={t("buttons.copyLink")}
            icon={copyIcon}
            status={copyStatus}
            onClick={copyRoomLink}
          />
        </div>
        <div className="ShareableLinkDialog__description">
          🔒 {t("alerts.uploadedSecurly")}
        </div>
      </div>
    </Dialog>
  );
};

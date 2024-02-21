import { useRef, useState } from "react";
import * as Popover from "@radix-ui/react-popover";

import { copyTextToSystemClipboard } from "../clipboard";
import { useI18n } from "../i18n";

import { Dialog } from "./Dialog";
import { TextField } from "./TextField";
import { FilledButton } from "./FilledButton";
import { copyIcon, tablerCheckIcon } from "./icons";

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
  const [justCopied, setJustCopied] = useState(false);
  const timerRef = useRef<number>(0);
  const ref = useRef<HTMLInputElement>(null);

  const copyRoomLink = async () => {
    try {
      await copyTextToSystemClipboard(link);
    } catch (e) {
      setErrorMessage(t("errors.copyToSystemClipboardFailed"));
    }
    setJustCopied(true);

    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
    }

    timerRef.current = window.setTimeout(() => {
      setJustCopied(false);
    }, 3000);

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
          <Popover.Root open={justCopied}>
            <Popover.Trigger asChild>
              <FilledButton
                size="large"
                label="Copy link"
                icon={copyIcon}
                onClick={copyRoomLink}
              />
            </Popover.Trigger>
            <Popover.Content
              onOpenAutoFocus={(event) => event.preventDefault()}
              onCloseAutoFocus={(event) => event.preventDefault()}
              className="ShareableLinkDialog__popover"
              side="top"
              align="end"
              sideOffset={5.5}
            >
              {tablerCheckIcon} copied
            </Popover.Content>
          </Popover.Root>
        </div>
        <div className="ShareableLinkDialog__description">
          🔒 {t("alerts.uploadedSecurly")}
        </div>
      </div>
    </Dialog>
  );
};

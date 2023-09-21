import { useRef, useState } from "react";
import * as Popover from "@radix-ui/react-popover";

import { copyTextToSystemClipboard } from "../../src/clipboard";
import { trackEvent } from "../../src/analytics";
import { getFrame } from "../../src/utils";
import { useI18n } from "../../src/i18n";
import { KEYS } from "../../src/keys";

import { Dialog } from "../../src/components/Dialog";
import {
  copyIcon,
  playerPlayIcon,
  playerStopFilledIcon,
  share,
  shareIOS,
  shareWindows,
  tablerCheckIcon,
} from "../../src/components/icons";
import { TextField } from "../../src/components/TextField";
import { FilledButton } from "../../src/components/FilledButton";

import { ReactComponent as CollabImage } from "../../src/assets/lock.svg";
import "./RoomDialog.scss";

const getShareIcon = () => {
  const navigator = window.navigator as any;
  const isAppleBrowser = /Apple/.test(navigator.vendor);
  const isWindowsBrowser = navigator.appVersion.indexOf("Win") !== -1;

  if (isAppleBrowser) {
    return shareIOS;
  } else if (isWindowsBrowser) {
    return shareWindows;
  }

  return share;
};

export type RoomModalProps = {
  handleClose: () => void;
  activeRoomLink: string;
  username: string;
  onUsernameChange: (username: string) => void;
  onRoomCreate: () => void;
  onRoomDestroy: () => void;
  setErrorMessage: (message: string) => void;
};

export const RoomModal = ({
  activeRoomLink,
  onRoomCreate,
  onRoomDestroy,
  setErrorMessage,
  username,
  onUsernameChange,
  handleClose,
}: RoomModalProps) => {
  const { t } = useI18n();
  const [justCopied, setJustCopied] = useState(false);
  const timerRef = useRef<number>(0);
  const ref = useRef<HTMLInputElement>(null);
  const isShareSupported = "share" in navigator;

  const copyRoomLink = async () => {
    try {
      await copyTextToSystemClipboard(activeRoomLink);

      setJustCopied(true);

      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }

      timerRef.current = window.setTimeout(() => {
        setJustCopied(false);
      }, 3000);
    } catch (error: any) {
      setErrorMessage(error.message);
    }

    ref.current?.select();
  };

  const shareRoomLink = async () => {
    try {
      await navigator.share({
        title: t("roomDialog.shareTitle"),
        text: t("roomDialog.shareTitle"),
        url: activeRoomLink,
      });
    } catch (error: any) {
      // Just ignore.
    }
  };

  if (activeRoomLink) {
    return (
      <>
        <h3 className="RoomDialog__active__header">
          {t("labels.liveCollaboration")}
        </h3>
        <TextField
          value={username}
          placeholder="Your name"
          label="Your name"
          onChange={onUsernameChange}
          onKeyDown={(event) => event.key === KEYS.ENTER && handleClose()}
        />
        <div className="RoomDialog__active__linkRow">
          <TextField
            ref={ref}
            label="Link"
            readonly
            fullWidth
            value={activeRoomLink}
          />
          {isShareSupported && (
            <FilledButton
              size="large"
              variant="icon"
              label="Share"
              startIcon={getShareIcon()}
              className="RoomDialog__active__share"
              onClick={shareRoomLink}
            />
          )}
          <Popover.Root open={justCopied}>
            <Popover.Trigger asChild>
              <FilledButton
                size="large"
                label="Copy link"
                startIcon={copyIcon}
                onClick={copyRoomLink}
              />
            </Popover.Trigger>
            <Popover.Content
              onOpenAutoFocus={(event) => event.preventDefault()}
              onCloseAutoFocus={(event) => event.preventDefault()}
              className="RoomDialog__popover"
              side="top"
              align="end"
              sideOffset={5.5}
            >
              {tablerCheckIcon} copied
            </Popover.Content>
          </Popover.Root>
        </div>
        <div className="RoomDialog__active__description">
          <p>
            <span
              role="img"
              aria-hidden="true"
              className="RoomDialog__active__description__emoji"
            >
              🔒{" "}
            </span>
            {t("roomDialog.desc_privacy")}
          </p>
          <p>{t("roomDialog.desc_exitSession")}</p>
        </div>

        <div className="RoomDialog__active__actions">
          <FilledButton
            size="large"
            variant="outlined"
            color="danger"
            label={t("roomDialog.button_stopSession")}
            startIcon={playerStopFilledIcon}
            onClick={() => {
              trackEvent("share", "room closed");
              onRoomDestroy();
            }}
          />
        </div>
      </>
    );
  }

  return (
    <>
      <div className="RoomDialog__inactive__illustration">
        <CollabImage />
      </div>
      <div className="RoomDialog__inactive__header">
        {t("labels.liveCollaboration")}
      </div>

      <div className="RoomDialog__inactive__description">
        <strong>{t("roomDialog.desc_intro")}</strong>
        {t("roomDialog.desc_privacy")}
      </div>

      <div className="RoomDialog__inactive__start_session">
        <FilledButton
          size="large"
          label={t("roomDialog.button_startSession")}
          startIcon={playerPlayIcon}
          onClick={() => {
            trackEvent("share", "room creation", `ui (${getFrame()})`);
            onRoomCreate();
          }}
        />
      </div>
    </>
  );
};

const RoomDialog = (props: RoomModalProps) => {
  return (
    <Dialog size="small" onCloseRequest={props.handleClose} title={false}>
      <div className="RoomDialog">
        <RoomModal {...props} />
      </div>
    </Dialog>
  );
};

export default RoomDialog;

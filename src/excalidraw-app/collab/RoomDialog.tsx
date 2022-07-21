import React, { useRef } from "react";
import { copyTextToSystemClipboard } from "../../clipboard";
import { Dialog } from "../../components/Dialog";
import {
  clipboard,
  start,
  stop,
  share,
  shareIOS,
  shareWindows,
} from "../../components/icons";
import { ToolButton } from "../../components/ToolButton";
import { t } from "../../i18n";
import "./RoomDialog.scss";
import Stack from "../../components/Stack";
import { AppState } from "../../types";
import { trackEvent } from "../../analytics";
import { getFrame } from "../../utils";

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

const RoomDialog = ({
  handleClose,
  activeRoomLink,
  username,
  onUsernameChange,
  onRoomCreate,
  onRoomDestroy,
  setErrorMessage,
  theme,
}: {
  handleClose: () => void;
  activeRoomLink: string;
  username: string;
  onUsernameChange: (username: string) => void;
  onRoomCreate: () => void;
  onRoomDestroy: () => void;
  setErrorMessage: (message: string) => void;
  theme: AppState["theme"];
}) => {
  const roomLinkInput = useRef<HTMLInputElement>(null);

  const copyRoomLink = async () => {
    try {
      await copyTextToSystemClipboard(activeRoomLink);
    } catch (error: any) {
      setErrorMessage(error.message);
    }
    if (roomLinkInput.current) {
      roomLinkInput.current.select();
    }
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

  const selectInput = (event: React.MouseEvent<HTMLInputElement>) => {
    if (event.target !== document.activeElement) {
      event.preventDefault();
      (event.target as HTMLInputElement).select();
    }
  };

  const renderRoomDialog = () => {
    return (
      <div className="RoomDialog-modal">
        {!activeRoomLink && (
          <>
            <p>{t("roomDialog.desc_intro")}</p>
            <p>{`🔒 ${t("roomDialog.desc_privacy")}`}</p>
            <div className="RoomDialog-sessionStartButtonContainer">
              <ToolButton
                className="RoomDialog-startSession"
                type="button"
                icon={start}
                title={t("roomDialog.button_startSession")}
                aria-label={t("roomDialog.button_startSession")}
                showAriaLabel={true}
                onClick={() => {
                  trackEvent("share", "room creation", `ui (${getFrame()})`);
                  onRoomCreate();
                }}
              />
            </div>
          </>
        )}
        {activeRoomLink && (
          <>
            <p>{t("roomDialog.desc_inProgressIntro")}</p>
            <p>{t("roomDialog.desc_shareLink")}</p>
            <div className="RoomDialog-linkContainer">
              <Stack.Row gap={2}>
                {"share" in navigator ? (
                  <ToolButton
                    type="button"
                    icon={getShareIcon()}
                    title={t("labels.share")}
                    aria-label={t("labels.share")}
                    onClick={shareRoomLink}
                  />
                ) : null}
                <ToolButton
                  type="button"
                  icon={clipboard}
                  title={t("labels.copy")}
                  aria-label={t("labels.copy")}
                  onClick={copyRoomLink}
                />
              </Stack.Row>
              <input
                type="text"
                value={activeRoomLink}
                readOnly={true}
                className="RoomDialog-link"
                ref={roomLinkInput}
                onPointerDown={selectInput}
              />
            </div>
            <div className="RoomDialog-usernameContainer">
              <label className="RoomDialog-usernameLabel" htmlFor="username">
                {t("labels.yourName")}
              </label>
              <input
                type="text"
                id="username"
                value={username || ""}
                className="RoomDialog-username TextInput"
                onChange={(event) => onUsernameChange(event.target.value)}
                onKeyPress={(event) => event.key === "Enter" && handleClose()}
              />
            </div>
            <p>
              <span role="img" aria-hidden="true" className="RoomDialog-emoji">
                {"🔒"}
              </span>{" "}
              {t("roomDialog.desc_privacy")}
            </p>
            <p>{t("roomDialog.desc_exitSession")}</p>
            <div className="RoomDialog-sessionStartButtonContainer">
              <ToolButton
                className="RoomDialog-stopSession"
                type="button"
                icon={stop}
                title={t("roomDialog.button_stopSession")}
                aria-label={t("roomDialog.button_stopSession")}
                showAriaLabel={true}
                onClick={() => {
                  trackEvent("share", "room closed");
                  onRoomDestroy();
                }}
              />
            </div>
          </>
        )}
      </div>
    );
  };
  return (
    <Dialog
      small
      onCloseRequest={handleClose}
      title={t("labels.liveCollaboration")}
      theme={theme}
    >
      {renderRoomDialog()}
    </Dialog>
  );
};

export default RoomDialog;

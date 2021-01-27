import React, { ChangeEvent, useRef } from "react";
import { copyTextToSystemClipboard } from "../../clipboard";
import { Dialog } from "../../components/Dialog";
import { clipboard, start, stop } from "../../components/icons";
import { ToolButton } from "../../components/ToolButton";
import { t } from "../../i18n";
import "./RoomDialog.scss";

declare global {
  interface Window {
    IdleDetector: any;
  }
}

const idleDetectorSupported: boolean = "IdleDetector" in window;
let idleDetectionPermissionGranted: boolean = false;

const RoomDialog = ({
  handleClose,
  activeRoomLink,
  username,
  onUsernameChange,
  onRoomCreate,
  onRoomDestroy,
  setErrorMessage,
}: {
  handleClose: () => void;
  activeRoomLink: string;
  username: string;
  onUsernameChange: (username: string) => void;
  onRoomCreate: () => void;
  onRoomDestroy: () => void;
  setErrorMessage: (message: string) => void;
}) => {
  const roomLinkInput = useRef<HTMLInputElement>(null);

  const copyRoomLink = async () => {
    try {
      await copyTextToSystemClipboard(activeRoomLink);
    } catch (error) {
      setErrorMessage(error.message);
    }
    if (roomLinkInput.current) {
      roomLinkInput.current.select();
    }
  };

  const selectInput = (event: React.MouseEvent<HTMLInputElement>) => {
    if (event.target !== document.activeElement) {
      event.preventDefault();
      (event.target as HTMLInputElement).select();
    }
  };

  const onShareIdleStateChange = async (e: ChangeEvent) => {
    if (!idleDetectorSupported) {
      return;
    }
    const checkbox = e.target;
    if ((checkbox as HTMLInputElement).checked) {
      const state = await window.IdleDetector.requestPermission();
      if (state !== "granted") {
        console.log("Idle detection permission not granted.");
        (checkbox as HTMLInputElement).checked = false;
        idleDetectionPermissionGranted = false;
      } else {
        console.log("Idle detection permission granted.");
        (checkbox as HTMLInputElement).checked = true;
        idleDetectionPermissionGranted = true;
      }
      const ev = new CustomEvent('idledetectionpermissionchange', {detail: {idleDetectionPermissionGranted}});
      document.dispatchEvent(ev);
    }
  };

  const renderRoomDialog = () => {
    return (
      <div className="RoomDialog-modal">
        {!activeRoomLink && (
          <>
            <p>{t("roomDialog.desc_intro")}</p>
            <p>{`🔒 ${t("roomDialog.desc_privacy")}`}</p>
            <p>
              <input
                id="shareIdleState"
                type="checkbox"
                checked={false}
                hidden={!idleDetectorSupported}
                onChange={onShareIdleStateChange}
              />
              <label htmlFor="shareIdleState" hidden={!idleDetectorSupported}>
                {t("labels.shareIdleState")}
              </label>
            </p>
            <div className="RoomDialog-sessionStartButtonContainer">
              <ToolButton
                className="RoomDialog-startSession"
                type="button"
                icon={start}
                title={t("roomDialog.button_startSession")}
                aria-label={t("roomDialog.button_startSession")}
                showAriaLabel={true}
                onClick={onRoomCreate}
              />
            </div>
          </>
        )}
        {activeRoomLink && (
          <>
            <p>{t("roomDialog.desc_inProgressIntro")}</p>
            <p>{t("roomDialog.desc_shareLink")}</p>
            <div className="RoomDialog-linkContainer">
              <ToolButton
                type="button"
                icon={clipboard}
                title={t("labels.copy")}
                aria-label={t("labels.copy")}
                onClick={copyRoomLink}
              />
              <input
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
                id="username"
                value={username || ""}
                className="RoomDialog-username TextInput"
                onChange={(event) => onUsernameChange(event.target.value)}
                onKeyPress={(event) => event.key === "Enter" && handleClose()}
              />
            </div>
            <p>
              <input
                id="shareIdleState"
                type="checkbox"
                checked={idleDetectionPermissionGranted}
                hidden={!idleDetectorSupported}
                onChange={onShareIdleStateChange}
              />
              <label htmlFor="shareIdleState" hidden={!idleDetectorSupported}>
                {t("labels.shareIdleState")}
              </label>
            </p>
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
                onClick={onRoomDestroy}
              />
            </div>
          </>
        )}
      </div>
    );
  };
  return (
    <Dialog small onCloseRequest={handleClose} title={t("labels.createRoom")}>
      {renderRoomDialog()}
    </Dialog>
  );
};

export default RoomDialog;

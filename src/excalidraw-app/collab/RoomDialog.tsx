import React, { useRef } from "react";
import { copyTextToSystemClipboard } from "../../clipboard";
import { Dialog } from "../../components/Dialog";
import { clipboard, start, stop } from "../../components/icons";
import { ToolButton } from "../../components/ToolButton";
import { t } from "../../i18n";
import "./RoomDialog.scss";

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
    <Dialog
      small
      onCloseRequest={handleClose}
      title={t("labels.liveCollaboration")}
    >
      {renderRoomDialog()}
    </Dialog>
  );
};

export default RoomDialog;

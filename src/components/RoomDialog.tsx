import clsx from "clsx";
import React, { useEffect, useRef, useState } from "react";
import { EVENT_DIALOG, EVENT_SHARE, trackEvent } from "../analytics";
import { copyTextToSystemClipboard } from "../clipboard";
import { t } from "../i18n";
import useIsMobile from "../is-mobile";
import { KEYS } from "../keys";
import { AppState } from "../types";
import { Dialog } from "./Dialog";
import { clipboard, start, stop, users } from "./icons";
import "./RoomDialog.scss";
import { ToolButton } from "./ToolButton";

const RoomModal = ({
  activeRoomLink,
  username,
  onUsernameChange,
  onRoomCreate,
  onRoomDestroy,
  onPressingEnter,
  setErrorMessage,
}: {
  activeRoomLink: string;
  username: string;
  onUsernameChange: (username: string) => void;
  onRoomCreate: () => void;
  onRoomDestroy: () => void;
  onPressingEnter: () => void;
  setErrorMessage: (message: string) => void;
}) => {
  const roomLinkInput = useRef<HTMLInputElement>(null);

  const copyRoomLink = async () => {
    try {
      await copyTextToSystemClipboard(activeRoomLink);
      trackEvent(EVENT_SHARE, "copy link");
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
              onBlur={() => trackEvent(EVENT_SHARE, "name")}
              onKeyPress={(event) =>
                event.key === KEYS.ENTER && onPressingEnter()
              }
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

export const RoomDialog = ({
  isCollaborating,
  collaboratorCount,
  username,
  onUsernameChange,
  onRoomCreate,
  onRoomDestroy,
  setErrorMessage,
}: {
  isCollaborating: AppState["isCollaborating"];
  collaboratorCount: number;
  username: string;
  onUsernameChange: (username: string) => void;
  onRoomCreate: () => void;
  onRoomDestroy: () => void;
  setErrorMessage: (message: string) => void;
}) => {
  const [modalIsShown, setModalIsShown] = useState(false);
  const [activeRoomLink, setActiveRoomLink] = useState("");

  const triggerButton = useRef<HTMLButtonElement>(null);

  const handleClose = React.useCallback(() => {
    setModalIsShown(false);
    triggerButton.current?.focus();
  }, []);

  useEffect(() => {
    setActiveRoomLink(isCollaborating ? window.location.href : "");
  }, [isCollaborating]);

  return (
    <>
      <ToolButton
        className={clsx("RoomDialog-modalButton", {
          "is-collaborating": isCollaborating,
        })}
        onClick={() => {
          trackEvent(EVENT_DIALOG, "collaboration");
          setModalIsShown(true);
        }}
        icon={users}
        type="button"
        title={t("buttons.roomDialog")}
        aria-label={t("buttons.roomDialog")}
        showAriaLabel={useIsMobile()}
        ref={triggerButton}
      >
        {collaboratorCount > 0 && (
          <div className="RoomDialog-modalButton-collaborators">
            {collaboratorCount}
          </div>
        )}
      </ToolButton>
      {modalIsShown && (
        <Dialog
          maxWidth={800}
          onCloseRequest={handleClose}
          title={t("labels.createRoom")}
        >
          <RoomModal
            activeRoomLink={activeRoomLink}
            username={username}
            onUsernameChange={onUsernameChange}
            onRoomCreate={onRoomCreate}
            onRoomDestroy={onRoomDestroy}
            onPressingEnter={handleClose}
            setErrorMessage={setErrorMessage}
          />
        </Dialog>
      )}
    </>
  );
};

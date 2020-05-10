import React, { useState, useEffect, useRef } from "react";
import { ToolButton } from "./ToolButton";
import { t } from "../i18n";
import useIsMobile from "../is-mobile";
import { users, clipboard, start, stop } from "./icons";

import "./RoomDialog.scss";
import { copyTextToSystemClipboard } from "../clipboard";
import { Dialog } from "./Dialog";
import { AppState } from "../types";

function RoomModal({
  activeRoomLink,
  username,
  onUsernameChange,
  onRoomCreate,
  onRoomDestroy,
  onPressingEnter,
}: {
  activeRoomLink: string;
  username: string;
  onUsernameChange: (username: string) => void;
  onRoomCreate: () => void;
  onRoomDestroy: () => void;
  onPressingEnter: () => void;
}) {
  const roomLinkInput = useRef<HTMLInputElement>(null);

  function copyRoomLink() {
    copyTextToSystemClipboard(activeRoomLink);
    if (roomLinkInput.current) {
      roomLinkInput.current.select();
    }
  }
  function selectInput(event: React.MouseEvent<HTMLInputElement>) {
    if (event.target !== document.activeElement) {
      event.preventDefault();
      (event.target as HTMLInputElement).select();
    }
  }

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
              onKeyPress={(event) => event.key === "Enter" && onPressingEnter()}
            />
          </div>
          <p>{`🔒 ${t("roomDialog.desc_privacy")}`}</p>
          <p>
            <span role="img" aria-hidden="true">
              ⚠️
            </span>{" "}
            {t("roomDialog.desc_persistenceWarning")}
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
}

export function RoomDialog({
  isCollaborating,
  collaboratorCount,
  username,
  onUsernameChange,
  onRoomCreate,
  onRoomDestroy,
}: {
  isCollaborating: AppState["isCollaborating"];
  collaboratorCount: number;
  username: string;
  onUsernameChange: (username: string) => void;
  onRoomCreate: () => void;
  onRoomDestroy: () => void;
}) {
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
        className={`RoomDialog-modalButton ${
          isCollaborating ? "is-collaborating" : ""
        }`}
        onClick={() => setModalIsShown(true)}
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
          />
        </Dialog>
      )}
    </>
  );
}

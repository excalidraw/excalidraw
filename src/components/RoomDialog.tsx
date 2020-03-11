import React, { useState, useEffect, useRef } from "react";
import { ToolButton } from "./ToolButton";
import { Island } from "./Island";
import { t } from "../i18n";
import useIsMobile from "../is-mobile";
import { users, clipboard, start, stop } from "./icons";
import { Modal } from "./Modal";
import { copyTextToSystemClipboard } from "../clipboard";
import { AppState } from "../types";
import "./RoomDialog.scss";

function RoomModal({
  onCloseRequest,
  activeRoomLink,
  onRoomCreate,
  onRoomDestroy,
}: {
  onCloseRequest: () => void;
  activeRoomLink: string;
  onRoomCreate: () => void;
  onRoomDestroy: () => void;
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
      <Island padding={4}>
        <button
          className="Modal__close"
          onClick={onCloseRequest}
          aria-label={t("buttons.close")}
        >
          ╳
        </button>
        <h2 id="export-title">{t("labels.createRoom")}</h2>
        {!activeRoomLink && (
          <>
            <p>{t("roomDialog.desc_intro")}</p>
            <p>{`🔒 ${t("roomDialog.desc_privacy")}`}</p>
            <p>{t("roomDialog.desc_start")}</p>
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
      </Island>
    </div>
  );
}

export function RoomDialog({
  isCollaborating,
  collaboratorCount,
  onRoomCreate,
  onRoomDestroy,
}: {
  isCollaborating: AppState["isCollaborating"];
  collaboratorCount: AppState["collaboratorCount"];
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
        <Modal
          maxWidth={800}
          labelledBy="room-title"
          onCloseRequest={handleClose}
        >
          <RoomModal
            onCloseRequest={handleClose}
            activeRoomLink={activeRoomLink}
            onRoomCreate={onRoomCreate}
            onRoomDestroy={onRoomDestroy}
          />
        </Modal>
      )}
    </>
  );
}

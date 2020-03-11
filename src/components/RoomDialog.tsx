import React, { useState, useEffect, useRef } from "react";
import { ToolButton } from "./ToolButton";
import { Island } from "./Island";
import { t } from "../i18n";
import useIsMobile from "../is-mobile";
import { users, clipboard, start } from "./icons";
import { Modal } from "./Modal";
import { generateCollaborationLink, getCollaborationLinkData } from "../data";

import "./RoomDialog.scss";
import { copyTextToSystemClipboard } from "../clipboard";

function RoomModal({
  onCloseRequest,
  activeRoomLink,
  onStartSession,
}: {
  onCloseRequest: () => void;
  activeRoomLink: string;
  onStartSession: () => void;
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
                onClick={onStartSession}
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
            <p>{t("roomDialog.desc_exitSession")}</p>
          </>
        )}
      </Island>
    </div>
  );
}

export function RoomDialog({ isCollaborating }: { isCollaborating: boolean }) {
  const [modalIsShown, setModalIsShown] = useState(
    window.location.href.includes("showSessionSplash=true"),
  );
  const [activeRoomLink, setActiveRoomLink] = useState("");

  const triggerButton = useRef<HTMLButtonElement>(null);

  const handleClose = React.useCallback(() => {
    setModalIsShown(false);
    triggerButton.current?.focus();
  }, []);

  useEffect(() => {
    if (getCollaborationLinkData(window.location.href)) {
      window.history.replaceState(
        {},
        "Excalidraw",
        window.location.href.replace("?showSessionSplash=true", ""),
      );
      setActiveRoomLink(window.location.href);
    }
  }, [isCollaborating]);

  async function startSession() {
    window.open(await generateCollaborationLink());
  }

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
      />
      {modalIsShown && (
        <Modal
          maxWidth={800}
          labelledBy="room-title"
          onCloseRequest={handleClose}
        >
          <RoomModal
            onCloseRequest={handleClose}
            activeRoomLink={activeRoomLink}
            onStartSession={startSession}
          />
        </Modal>
      )}
    </>
  );
}

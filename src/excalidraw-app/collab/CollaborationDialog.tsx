import React from "react";
import { t } from "../../i18n";
import { Dialog } from "../../components/Dialog";
import RoomModal from "./RoomModal";
const CollaborationDialog = ({
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
  return (
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
  );
};

export default CollaborationDialog;

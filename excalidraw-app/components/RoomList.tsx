import { useState, useEffect } from "react";
import { trackEvent } from "@excalidraw/excalidraw/analytics";
import { useI18n } from "@excalidraw/excalidraw/i18n";
import {
  FreedrawIcon,
  LinkIcon,
  TrashIcon,
} from "@excalidraw/excalidraw/components/icons";

import { roomManager, type CollabRoom } from "../data/roomManager";

import "./RoomList.scss";

import type { CollabAPI } from "../collab/Collab";

interface RoomListProps {
  collabAPI: CollabAPI;
  onRoomSelect: (roomId: string, roomKey: string) => void;
  handleClose: () => void;
}

const formatDate = (timestamp: number, t: ReturnType<typeof useI18n>["t"]) => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return t("roomDialog.today");
  } else if (diffDays === 1) {
    return t("roomDialog.yesterday");
  } else if (diffDays < 7) {
    return t("roomDialog.daysAgo", { days: diffDays });
  }
  return date.toLocaleDateString();
};

const RoomItem = ({
  room,
  onDelete,
  onSelect,
  onRename,
}: {
  room: CollabRoom;
  onDelete: (roomId: string) => void;
  onSelect: (roomId: string, roomKey: string) => void;
  onRename: (roomId: string, name: string) => void;
}) => {
  const { t } = useI18n();
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(room.name || "");

  const handleRename = () => {
    if (editName.trim()) {
      onRename(room.roomId, editName.trim());
    }
    setIsEditing(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter") {
      handleRename();
    } else if (event.key === "Escape") {
      setEditName(room.name || "");
      setIsEditing(false);
    }
  };

  return (
    <div className="RoomItem">
      <div className="RoomItem__info">
        <div className="RoomItem__name">
          {isEditing ? (
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={handleRename}
              onKeyDown={handleKeyDown}
              placeholder={t("roomDialog.roomNamePlaceholder")}
              autoFocus
              className="RoomItem__nameInput"
            />
          ) : (
            <span
              className="RoomItem__nameText"
              onClick={() => setIsEditing(true)}
              title={t("roomDialog.roomNameTooltip")}
            >
              {room.name || `Room ${room.roomId}`}
            </span>
          )}
        </div>
        <div className="RoomItem__meta">
          <span className="RoomItem__date">
            {t("roomDialog.created")} {formatDate(room.createdAt, t)}
          </span>
          {room.lastAccessed !== room.createdAt && (
            <>
              <span>•</span>
              <span className="RoomItem__lastAccessed">
                {t("roomDialog.lastUsed")}: {formatDate(room.lastAccessed, t)}
              </span>
            </>
          )}
        </div>
      </div>
      <div className="RoomItem__actions">
        <button
          className="RoomItem__action"
          onClick={() => onSelect(room.roomId, room.roomKey)}
          title={t("roomDialog.copyRoomLinkTooltip")}
          aria-label={t("roomDialog.copyRoomLinkTooltip")}
        >
          {LinkIcon}
        </button>
        <button
          className="RoomItem__action"
          onClick={() => setIsEditing(true)}
          title={t("roomDialog.renameRoomTooltip")}
          aria-label={t("roomDialog.renameRoomTooltip")}
        >
          {FreedrawIcon}
        </button>
        <button
          className="RoomItem__action RoomItem__action--danger"
          onClick={() => onDelete(room.roomId)}
          title={t("roomDialog.deleteRoomTooltip")}
          aria-label={t("roomDialog.deleteRoomTooltip")}
        >
          {TrashIcon}
        </button>
      </div>
    </div>
  );
};

export const RoomList = ({
  collabAPI,
  onRoomSelect,
  handleClose,
}: RoomListProps) => {
  const { t } = useI18n();
  const [rooms, setRooms] = useState<CollabRoom[]>([]);
  const [loading, setLoading] = useState(true);

  const loadRooms = async () => {
    try {
      const userRooms = await roomManager.getRooms();
      setRooms(userRooms);
    } catch (error) {
      console.error("Failed to load rooms:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRooms();
  }, []);

  const handleDeleteRoom = async (roomId: string) => {
    if (window.confirm(t("roomDialog.deleteRoomConfirm"))) {
      try {
        await roomManager.deleteRoom(roomId);
        await loadRooms(); // Refresh the list
        trackEvent("share", "room deleted");
      } catch (error) {
        console.error("Failed to delete room:", error);
      }
    }
  };

  const handleRenameRoom = async (roomId: string, name: string) => {
    try {
      await roomManager.updateRoomName(roomId, name);
      await loadRooms(); // Refresh the list
    } catch (error) {
      console.error("Failed to rename room:", error);
    }
  };

  const handleRoomSelect = async (roomId: string, roomKey: string) => {
    try {
      await roomManager.updateRoomAccess(roomId);
      trackEvent("share", "room rejoined");
      onRoomSelect(roomId, roomKey);
    } catch (error) {
      console.error("Failed to update room access:", error);
      onRoomSelect(roomId, roomKey);
    }
  };

  const handleClearAll = async () => {
    if (window.confirm(t("roomDialog.deleteAllRoomsConfirm"))) {
      try {
        await roomManager.clearAllRooms();
        setRooms([]);
        trackEvent("share", "all rooms cleared");
      } catch (error) {
        console.error("Failed to clear all rooms:", error);
      }
    }
  };

  if (loading) {
    return (
      <div className="RoomList">
        <div className="RoomList__header">
          <h3>{t("roomDialog.roomListTitle")}</h3>
        </div>
        <div className="RoomList__loading">
          {t("roomDialog.roomListLoading")}
        </div>
      </div>
    );
  }

  return (
    <div className="RoomList">
      <div className="RoomList__header">
        <h3>{t("roomDialog.roomListTitle")}</h3>
        {rooms.length > 0 && (
          <button
            className="RoomList__clearAll"
            onClick={handleClearAll}
            title={t("roomDialog.deleteAllRooms")}
          >
            {t("roomDialog.deleteAllRooms")}
          </button>
        )}
      </div>

      <p className="RoomList__description">
        {t("roomDialog.roomListDescription")}
      </p>

      {rooms.length === 0 ? (
        <div className="RoomList__empty">
          <p>{t("roomDialog.roomListEmpty")}</p>
          <p>{t("roomDialog.roomListEmptySubtext")}</p>
        </div>
      ) : (
        <div className="RoomList__items">
          {rooms.map((room) => (
            <RoomItem
              key={room.id}
              room={room}
              onDelete={handleDeleteRoom}
              onSelect={handleRoomSelect}
              onRename={handleRenameRoom}
            />
          ))}
        </div>
      )}
    </div>
  );
};

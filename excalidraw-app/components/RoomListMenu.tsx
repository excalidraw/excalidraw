import { useEffect, useState } from "react";
import { MainMenu } from "@excalidraw/excalidraw/index";
import {
  usersIcon,
  clockIcon,
  starFilledIcon,
  starIcon,
  roomIcon,
  searchIcon,
} from "@excalidraw/excalidraw/components/icons";

import "./RoomListMenu.scss";
import {
  fetchAllRooms,
  getRoomHistory,
  removeRoomFromHistory,
  toggleRoomFavorite,
  type RoomMetadata,
  type RoomHistoryItem,
} from "../data/roomMetadata";

type RoomListMenuProps = {
  currentRoomId: string | null;
  onRoomSelect: (roomId: string, roomKey: string, displayName: string) => void;
  onCreateNewRoom: () => void;
};

export const RoomListMenu = ({
  currentRoomId,
  onRoomSelect,
  onCreateNewRoom,
}: RoomListMenuProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [allRooms, setAllRooms] = useState<RoomMetadata[]>([]);
  const [localHistory, setLocalHistory] = useState<RoomHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadRooms();
    loadLocalHistory();
  }, []);

  const loadRooms = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { rooms } = await fetchAllRooms({
        limit: 100,
        sortBy: "updatedAt",
        sortOrder: "desc",
      });
      setAllRooms(rooms);
    } catch (err) {
      console.error("Failed to load rooms:", err);
      setError("Failed to load rooms from server");
    } finally {
      setIsLoading(false);
    }
  };

  const loadLocalHistory = () => {
    const history = getRoomHistory();
    setLocalHistory(history.rooms);
  };

  const handleToggleFavorite = (roomId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    toggleRoomFavorite(roomId);
    loadLocalHistory();
  };

  const handleRemoveFromHistory = (roomId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    removeRoomFromHistory(roomId);
    loadLocalHistory();
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const filteredHistory = localHistory.filter((room) =>
    room.displayName.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const filteredAllRooms = allRooms.filter((room) =>
    room.displayName.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const favoriteRooms = filteredHistory.filter((r) => r.isFavorite);
  const recentRooms = filteredHistory.filter((r) => !r.isFavorite).slice(0, 10);

  return (
    <div className="room-list-menu">
      {/* Search */}
      <MainMenu.ItemCustom>
        <div className="room-search">
          <div className="room-search-icon">{searchIcon}</div>
          <input
            type="text"
            placeholder="Search rooms..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="room-search-input"
          />
        </div>
      </MainMenu.ItemCustom>

      <MainMenu.Separator />

      {/* Create New Room */}
      <MainMenu.Item icon={usersIcon} onSelect={onCreateNewRoom}>
        Create New Room
      </MainMenu.Item>

      <MainMenu.Separator />

      {/* Favorite Rooms */}
      {favoriteRooms.length > 0 && (
        <>
          <MainMenu.Group>
            <div className="room-list-heading">Favorites</div>
            {favoriteRooms.map((room) => (
              <MainMenu.ItemCustom key={room.roomId}>
                <div
                  className={`room-list-item ${
                    room.roomId === currentRoomId ? "active" : ""
                  }`}
                  onClick={() =>
                    onRoomSelect(room.roomId, room.roomKey, room.displayName)
                  }
                >
                  <div className="room-list-item-content">
                    <div className="room-list-item-name">{room.displayName}</div>
                    <div className="room-list-item-meta">
                      {formatTimeAgo(room.lastAccessed)}
                    </div>
                  </div>
                  <div className="room-list-item-actions">
                    <button
                      className="room-list-item-action"
                      onClick={(e) => handleToggleFavorite(room.roomId, e)}
                      title="Remove from favorites"
                    >
                      {starFilledIcon}
                    </button>
                  </div>
                </div>
              </MainMenu.ItemCustom>
            ))}
          </MainMenu.Group>
          <MainMenu.Separator />
        </>
      )}

      {/* Recent Rooms */}
      {recentRooms.length > 0 && (
        <>
          <MainMenu.Group>
            <div className="room-list-heading">Recent</div>
            {recentRooms.map((room) => (
              <MainMenu.ItemCustom key={room.roomId}>
                <div
                  className={`room-list-item ${
                    room.roomId === currentRoomId ? "active" : ""
                  }`}
                  onClick={() =>
                    onRoomSelect(room.roomId, room.roomKey, room.displayName)
                  }
                >
                  <div className="room-list-item-content">
                    <div className="room-list-item-name">{room.displayName}</div>
                    <div className="room-list-item-meta">
                      {formatTimeAgo(room.lastAccessed)}
                    </div>
                  </div>
                  <div className="room-list-item-actions">
                    <button
                      className="room-list-item-action"
                      onClick={(e) => handleToggleFavorite(room.roomId, e)}
                      title="Add to favorites"
                    >
                      {starIcon}
                    </button>
                  </div>
                </div>
              </MainMenu.ItemCustom>
            ))}
          </MainMenu.Group>
          <MainMenu.Separator />
        </>
      )}

      {/* All Rooms from Server */}
      <MainMenu.Group>
        <div className="room-list-heading">
          All Rooms
          {isLoading && <span className="room-list-loading">Loading...</span>}
        </div>
        
        {error && (
          <MainMenu.ItemCustom>
            <div className="room-list-error">{error}</div>
          </MainMenu.ItemCustom>
        )}
        
        {!isLoading && !error && filteredAllRooms.length === 0 && (
          <MainMenu.ItemCustom>
            <div className="room-list-empty">
              {searchQuery ? "No rooms found" : "No rooms available"}
            </div>
          </MainMenu.ItemCustom>
        )}
        
        {filteredAllRooms.slice(0, 20).map((room) => {
          const historyItem = localHistory.find((r) => r.roomId === room.roomId);
          
          return (
            <MainMenu.ItemCustom key={room.roomId}>
              <div
                className={`room-list-item ${
                  room.roomId === currentRoomId ? "active" : ""
                }`}
                onClick={() => {
                  // Use roomKey from history if available, otherwise user needs to know it
                  const roomKey = historyItem?.roomKey || "";
                  if (roomKey) {
                    onRoomSelect(room.roomId, roomKey, room.displayName);
                  } else {
                    alert(
                      "You don't have access to this room. Ask the room creator for the full link.",
                    );
                  }
                }}
              >
                <div className="room-list-item-content">
                  <div className="room-list-item-name">{room.displayName}</div>
                  <div className="room-list-item-meta">
                    <span title="Last updated">
                      {formatTimeAgo(room.updatedAt)}
                    </span>
                    {room.isActive && (
                      <span className="room-list-item-badge active">Active</span>
                    )}
                  </div>
                </div>
                {!historyItem && (
                  <div className="room-list-item-lock">🔒</div>
                )}
              </div>
            </MainMenu.ItemCustom>
          );
        })}
      </MainMenu.Group>
    </div>
  );
};

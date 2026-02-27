import type { ExcalidrawElement } from "@excalidraw/element/types";

const MONGODB_BACKEND_URL =
  import.meta.env.VITE_APP_MONGODB_BACKEND_URL || "http://localhost:3003";

const ROOM_HISTORY_KEY = "excalidraw-room-history";
const MAX_ROOM_HISTORY = 20;

export type RoomMetadata = {
  roomId: string;
  displayName: string;
  createdAt: string;
  updatedAt: string;
  lastAccessedAt: string;
  sceneVersion?: number;
  isActive?: boolean;
};

export type RoomHistoryItem = {
  roomId: string;
  roomKey: string;
  displayName: string;
  lastAccessed: string;
  isFavorite: boolean;
};

type RoomHistory = {
  rooms: RoomHistoryItem[];
};

// ============================================================================
// LocalStorage Management
// ============================================================================

export const saveRoomToHistory = (
  roomId: string,
  roomKey: string,
  displayName?: string,
) => {
  try {
    const history = getRoomHistory();
    
    // Remove existing entry if present
    const filtered = history.rooms.filter((r) => r.roomId !== roomId);
    
    // Add to beginning
    filtered.unshift({
      roomId,
      roomKey,
      displayName: displayName || `Room ${roomId.substring(0, 8)}`,
      lastAccessed: new Date().toISOString(),
      isFavorite: false,
    });
    
    // Keep only last MAX_ROOM_HISTORY items
    const trimmed = filtered.slice(0, MAX_ROOM_HISTORY);
    
    localStorage.setItem(
      ROOM_HISTORY_KEY,
      JSON.stringify({ rooms: trimmed }),
    );
  } catch (error) {
    console.error("Failed to save room to history:", error);
  }
};

export const getRoomHistory = (): RoomHistory => {
  try {
    const data = localStorage.getItem(ROOM_HISTORY_KEY);
    if (data) {
      return JSON.parse(data);
    }
  } catch (error) {
    console.error("Failed to get room history:", error);
  }
  return { rooms: [] };
};

export const updateRoomInHistory = (
  roomId: string,
  updates: Partial<RoomHistoryItem>,
) => {
  try {
    const history = getRoomHistory();
    const room = history.rooms.find((r) => r.roomId === roomId);
    
    if (room) {
      Object.assign(room, updates);
      localStorage.setItem(ROOM_HISTORY_KEY, JSON.stringify(history));
    }
  } catch (error) {
    console.error("Failed to update room in history:", error);
  }
};

export const removeRoomFromHistory = (roomId: string) => {
  try {
    const history = getRoomHistory();
    const filtered = history.rooms.filter((r) => r.roomId !== roomId);
    localStorage.setItem(
      ROOM_HISTORY_KEY,
      JSON.stringify({ rooms: filtered }),
    );
  } catch (error) {
    console.error("Failed to remove room from history:", error);
  }
};

export const toggleRoomFavorite = (roomId: string) => {
  try {
    const history = getRoomHistory();
    const room = history.rooms.find((r) => r.roomId === roomId);
    
    if (room) {
      room.isFavorite = !room.isFavorite;
      localStorage.setItem(ROOM_HISTORY_KEY, JSON.stringify(history));
    }
  } catch (error) {
    console.error("Failed to toggle room favorite:", error);
  }
};

// ============================================================================
// Backend API Calls
// ============================================================================

export const fetchAllRooms = async (options?: {
  limit?: number;
  offset?: number;
  sortBy?: "updatedAt" | "createdAt" | "displayName";
  sortOrder?: "asc" | "desc";
}): Promise<{
  rooms: RoomMetadata[];
  total: number;
}> => {
  const params = new URLSearchParams();
  if (options?.limit) params.append("limit", options.limit.toString());
  if (options?.offset) params.append("offset", options.offset.toString());
  if (options?.sortBy) params.append("sortBy", options.sortBy);
  if (options?.sortOrder) params.append("sortOrder", options.sortOrder);

  const response = await fetch(
    `${MONGODB_BACKEND_URL}/api/rooms?${params.toString()}`,
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch rooms: ${response.statusText}`);
  }

  const data = await response.json();
  return {
    rooms: data.rooms || [],
    total: data.total || 0,
  };
};

export const fetchRoomMetadata = async (
  roomId: string,
): Promise<RoomMetadata | null> => {
  try {
    const response = await fetch(
      `${MONGODB_BACKEND_URL}/api/rooms/${roomId}/metadata`,
    );

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`Failed to fetch room metadata: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching room metadata:", error);
    return null;
  }
};

export const updateRoomMetadata = async (
  roomId: string,
  metadata: { displayName: string },
): Promise<boolean> => {
  try {
    const response = await fetch(
      `${MONGODB_BACKEND_URL}/api/rooms/${roomId}/metadata`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(metadata),
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to update room metadata: ${response.statusText}`);
    }

    // Also update local history
    updateRoomInHistory(roomId, { displayName: metadata.displayName });

    return true;
  } catch (error) {
    console.error("Error updating room metadata:", error);
    return false;
  }
};

export const generateDefaultRoomName = (
  roomId: string,
  elements?: readonly ExcalidrawElement[],
): string => {
  // Try to generate a name based on content
  if (elements && elements.length > 0) {
    const textElements = elements.filter((el) => el.type === "text");
    if (textElements.length > 0) {
      const firstText = (textElements[0] as any).text;
      if (firstText && firstText.trim()) {
        return firstText.trim().substring(0, 50);
      }
    }
  }
  
  // Fallback to generic name with room ID prefix
  const shortId = roomId.substring(0, 8);
  const date = new Date().toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  return `Untitled Room - ${date}`;
};

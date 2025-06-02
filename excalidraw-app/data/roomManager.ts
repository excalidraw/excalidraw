import {
  generateEncryptionKey,
  encryptData,
  decryptData,
} from "@excalidraw/excalidraw/data/encryption";

export interface CollabRoom {
  id: string;
  roomId: string;
  roomKey: string;
  createdAt: number;
  lastAccessed: number;
  url: string;
  name?: string;
}

interface EncryptedRoomData {
  rooms: CollabRoom[];
  version: number;
}

const ROOM_STORAGE_KEY = "excalidraw-user-rooms";
const ROOM_STORAGE_VERSION = 1;

class RoomManager {
  private userKey: string | null = null;

  private async getUserKey(): Promise<string> {
    if (this.userKey) {
      return this.userKey;
    }

    try {
      const stored = localStorage.getItem(`${ROOM_STORAGE_KEY}-key`);
      if (stored) {
        this.userKey = stored;
        return this.userKey;
      }
    } catch (error) {
      console.warn("Failed to load user key from localStorage:", error);
    }

    this.userKey = await generateEncryptionKey();

    try {
      localStorage.setItem(`${ROOM_STORAGE_KEY}-key`, this.userKey);
    } catch (error) {
      console.warn("Failed to save user key to localStorage:", error);
    }

    return this.userKey;
  }

  private async encryptRoomData(
    data: EncryptedRoomData,
  ): Promise<{ data: ArrayBuffer; iv: Uint8Array }> {
    const userKey = await this.getUserKey();
    const jsonData = JSON.stringify(data);
    const { encryptedBuffer, iv } = await encryptData(userKey, jsonData);
    return { data: encryptedBuffer, iv };
  }

  private async decryptRoomData(
    encryptedData: ArrayBuffer,
    iv: Uint8Array,
  ): Promise<EncryptedRoomData | null> {
    try {
      const userKey = await this.getUserKey();
      const decryptedBuffer = await decryptData(iv, encryptedData, userKey);
      const jsonString = new TextDecoder().decode(decryptedBuffer);
      const data = JSON.parse(jsonString) as EncryptedRoomData;

      if (data.version === ROOM_STORAGE_VERSION && Array.isArray(data.rooms)) {
        return data;
      }

      return null;
    } catch (error) {
      console.warn("Failed to decrypt room data:", error);
      return null;
    }
  }

  private async loadRooms(): Promise<CollabRoom[]> {
    try {
      const storedData = localStorage.getItem(ROOM_STORAGE_KEY);
      if (!storedData) {
        return [];
      }

      const { data, iv } = JSON.parse(storedData);
      const dataBuffer = new Uint8Array(data).buffer;
      const ivArray = new Uint8Array(iv);

      const decryptedData = await this.decryptRoomData(dataBuffer, ivArray);
      return decryptedData?.rooms || [];
    } catch (error) {
      console.warn("Failed to load rooms:", error);
      return [];
    }
  }

  private async saveRooms(rooms: CollabRoom[]): Promise<void> {
    try {
      const data: EncryptedRoomData = {
        rooms,
        version: ROOM_STORAGE_VERSION,
      };

      const { data: encryptedData, iv } = await this.encryptRoomData(data);

      const storageData = {
        data: Array.from(new Uint8Array(encryptedData)),
        iv: Array.from(iv),
      };

      localStorage.setItem(ROOM_STORAGE_KEY, JSON.stringify(storageData));
    } catch (error) {
      console.warn("Failed to save rooms:", error);
    }
  }

  async addRoom(
    roomId: string,
    roomKey: string,
    url: string,
    name?: string,
  ): Promise<void> {
    const rooms = await this.loadRooms();

    const filteredRooms = rooms.filter((room) => room.roomId !== roomId);

    const newRoom: CollabRoom = {
      id: crypto.randomUUID(),
      roomId,
      roomKey,
      createdAt: Date.now(),
      lastAccessed: Date.now(),
      url,
      name,
    };

    filteredRooms.unshift(newRoom);

    await this.saveRooms(filteredRooms);
  }

  async getRooms(): Promise<CollabRoom[]> {
    const rooms = await this.loadRooms();
    return rooms.sort((a, b) => b.lastAccessed - a.lastAccessed);
  }

  async updateRoomAccess(roomId: string): Promise<void> {
    const rooms = await this.loadRooms();
    const room = rooms.find((r) => r.roomId === roomId);

    if (room) {
      room.lastAccessed = Date.now();
      await this.saveRooms(rooms);
    }
  }

  async deleteRoom(roomId: string): Promise<void> {
    const rooms = await this.loadRooms();
    const filteredRooms = rooms.filter((room) => room.roomId !== roomId);
    await this.saveRooms(filteredRooms);
  }

  async updateRoomName(roomId: string, name: string): Promise<void> {
    const rooms = await this.loadRooms();
    const room = rooms.find((r) => r.roomId === roomId);

    if (room) {
      room.name = name;
      await this.saveRooms(rooms);
    }
  }

  async isRoomOwnedByUser(url: string): Promise<boolean> {
    try {
      const rooms = await this.loadRooms();
      const _url = new URL(url);
      const match = _url.hash.match(/room=([^,]+),([^&]+)/);

      if (!match) {
        return false;
      }

      const roomId = match[1];
      return rooms.some((room) => room.roomId === roomId);
    } catch (error) {
      console.warn("Failed to check room ownership:", error);
      return false;
    }
  }

  async getCurrentRoom(): Promise<CollabRoom | null> {
    const rooms = await this.loadRooms();
    if (rooms.length === 0) {
      return null;
    }

    // Return the most recently accessed room
    return rooms.sort((a, b) => b.lastAccessed - a.lastAccessed)[0];
  }

  async clearAllRooms(): Promise<void> {
    try {
      localStorage.removeItem(ROOM_STORAGE_KEY);
      localStorage.removeItem(`${ROOM_STORAGE_KEY}-key`);
      this.userKey = null;
    } catch (error) {
      console.warn("Failed to clear rooms:", error);
    }
  }
}

export const roomManager = new RoomManager();

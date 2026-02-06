/**
 * Board Manager - Handles CRUD operations for whiteboards stored in Google Drive
 */

import { appJotaiStore } from "../app-jotai";
import {
  googleDriveAuthAtom,
  currentBoardIdAtom,
  boardsListAtom,
  excalidrawFolderIdAtom,
} from "../app-jotai";

import { GoogleDriveService } from "./GoogleDrive";

export interface Board {
  id: string;
  name: string;
  folderId: string;
}

export class BoardManager {
  /**
   * Initialize board manager - ensure user is authenticated and folder exists
   */
  static async initialize(): Promise<void> {
    const auth = appJotaiStore.get(googleDriveAuthAtom);

    if (!auth.isAuthenticated || !auth.accessToken) {
      throw new Error("User not authenticated");
    }

    await GoogleDriveService.getOrCreateExcalidrawFolder(auth.accessToken);

    // Refresh boards list
    await this.refreshBoardsList();
  }

  /**
   * Refresh the list of boards from Google Drive
   */
  static async refreshBoardsList(): Promise<void> {
    const auth = appJotaiStore.get(googleDriveAuthAtom);
    const excalidrawFolderId = appJotaiStore.get(excalidrawFolderIdAtom);

    if (!auth.isAuthenticated || !auth.accessToken || !excalidrawFolderId) {
      appJotaiStore.set(boardsListAtom, []);
      return;
    }

    try {
      const boards = await GoogleDriveService.listBoards(
        auth.accessToken,
        excalidrawFolderId,
      );
      appJotaiStore.set(boardsListAtom, boards);
    } catch (error) {
      console.error("Failed to refresh boards list:", error);
      appJotaiStore.set(boardsListAtom, []);
    }
  }

  /**
   * Create a new board
   */
  static async createBoard(boardName: string): Promise<Board> {
    const auth = appJotaiStore.get(googleDriveAuthAtom);
    const excalidrawFolderId = appJotaiStore.get(excalidrawFolderIdAtom);

    if (!auth.isAuthenticated || !auth.accessToken || !excalidrawFolderId) {
      throw new Error("User not authenticated or Excalidraw folder not found");
    }

    // Generate board name if not provided
    const name = boardName || this.generateBoardName();

    const board = await GoogleDriveService.createBoardFolder(
      auth.accessToken,
      excalidrawFolderId,
      name,
    );

    // Create initial board.excalidraw file
    await GoogleDriveService.createInitialBoardFile(
      auth.accessToken,
      board.folderId,
    );

    // Refresh boards list
    await this.refreshBoardsList();

    return board;
  }

  /**
   * Generate a default board name (board01, board02, etc.)
   */
  private static generateBoardName(): string {
    const boards = appJotaiStore.get(boardsListAtom);
    const boardNumbers = boards
      .map((board) => {
        const match = board.name.match(/^board(\d+)$/);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter((num) => num > 0);

    const nextNumber =
      boardNumbers.length > 0 ? Math.max(...boardNumbers) + 1 : 1;

    return `board${String(nextNumber).padStart(2, "0")}`;
  }

  /**
   * Switch to a different board
   */
  static async switchBoard(boardId: string): Promise<void> {
    appJotaiStore.set(currentBoardIdAtom, boardId);

    // Persist current board ID to localStorage (persists across sessions)
    try {
      localStorage.setItem("excalidraw_current_board_id", boardId);
    } catch (error) {
      console.warn("Failed to persist current board ID:", error);
    }
  }

  /**
   * Rename a board
   */
  static async renameBoard(boardId: string, newName: string): Promise<void> {
    const auth = appJotaiStore.get(googleDriveAuthAtom);
    if (!auth.isAuthenticated || !auth.accessToken) {
      throw new Error("User not authenticated");
    }

    await GoogleDriveService.renameBoard(auth.accessToken, boardId, newName);

    await this.refreshBoardsList();
  }

  /**
   * Delete a board
   */
  static async deleteBoard(boardId: string): Promise<void> {
    const auth = appJotaiStore.get(googleDriveAuthAtom);

    if (!auth.isAuthenticated || !auth.accessToken) {
      throw new Error("User not authenticated");
    }

    await GoogleDriveService.deleteBoard(auth.accessToken, boardId);

    // If deleted board was current, clear current board
    const currentBoard = appJotaiStore.get(currentBoardIdAtom);
    if (currentBoard === boardId) {
      appJotaiStore.set(currentBoardIdAtom, null);
    }

    // Refresh boards list
    await this.refreshBoardsList();
  }

  /**
   * Get current board
   */
  static getCurrentBoard(): Board | null {
    const currentBoardId = appJotaiStore.get(currentBoardIdAtom);
    if (!currentBoardId) {
      return null;
    }

    const boards = appJotaiStore.get(boardsListAtom);
    return boards.find((board) => board.id === currentBoardId) || null;
  }

  /**
   * Get all boards
   */
  static getAllBoards(): Board[] {
    return appJotaiStore.get(boardsListAtom);
  }
}

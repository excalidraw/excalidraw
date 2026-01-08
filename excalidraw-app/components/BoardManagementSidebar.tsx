import React, { useState, useEffect } from "react";
import { Sidebar } from "@excalidraw/excalidraw/index";
import {
  LibraryIcon,
  TrashIcon,
  pencilIcon,
  loginIcon,
  PlusIcon,
} from "@excalidraw/excalidraw/components/icons";
import { ToolButton } from "@excalidraw/excalidraw/components/ToolButton";
import { useAtom, useAtomValue } from "excalidraw-app/app-jotai";

import { openConfirmModal } from "@excalidraw/excalidraw/components/OverwriteConfirm/OverwriteConfirmState";

import {
  googleDriveAuthAtom,
  currentBoardIdAtom,
  boardsListAtom,
} from "../app-jotai";
import { BoardManager } from "../data/BoardManager";
import { GoogleDriveService } from "../data/GoogleDrive";

import { GoogleAuthDialog } from "./GoogleAuthDialog";

import "./BoardManagementSidebar.scss";

export const BoardManagementSidebar: React.FC = () => {
  const auth = useAtomValue(googleDriveAuthAtom);
  const [currentBoardId, setCurrentBoardId] = useAtom(currentBoardIdAtom);
  const boards = useAtomValue(boardsListAtom);
  const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(false);
  const [isCreatingBoard, setIsCreatingBoard] = useState(false);

  useEffect(() => {
    if (auth.isAuthenticated) {
      BoardManager.refreshBoardsList();
    }
  }, [auth.isAuthenticated]);

  const handleCreateBoard = async () => {
    if (!auth.isAuthenticated) {
      setIsAuthDialogOpen(true);
      return;
    }

    setIsCreatingBoard(true);
    try {
      await BoardManager.initialize();
      const board = await BoardManager.createBoard("");
      await BoardManager.switchBoard(board.id);
      setCurrentBoardId(board.id);
      // Reload to switch to new board
      window.location.reload();
    } catch (error: any) {
      console.error("Failed to create board:", error);
      alert(error.message || "Failed to create board");
    } finally {
      setIsCreatingBoard(false);
    }
  };

  const handleSwitchBoard = async (boardId: string) => {
    if (boardId === currentBoardId) {
      return;
    }

    // Save current board before switching - wait for save to complete
    if (currentBoardId) {
      try {
        // Force a save and wait for it to complete
        const { LocalData } = await import("../data/LocalData");
        await LocalData.flushSave();
        // Additional wait to ensure Google Drive API completes
        await new Promise((resolve) => setTimeout(resolve, 300));
      } catch (error) {
        console.warn("Failed to save current board before switching:", error);
        // Continue anyway - user can recover from Google Drive
      }
    }

    await BoardManager.switchBoard(boardId);
    setCurrentBoardId(boardId);

    // Reload the scene - this will be handled by App.tsx
    window.location.reload();
  };

  const handleRenameBoard = async (boardId: string, currentName: string) => {
    const newName = prompt("Enter new board name:", currentName);
    if (!newName || newName.trim() === "" || newName.trim() === currentName) {
      return;
    }

    const trimmedName = newName.trim();

    // Validate name length
    if (trimmedName.length > 100) {
      alert("Board name must be 100 characters or less");
      return;
    }

    try {
      await BoardManager.renameBoard(boardId, trimmedName);
    } catch (error: any) {
      console.error("Failed to rename board:", error);
      alert(error.message || "Failed to rename board");
    }
  };

  const handleDeleteBoard = async (boardId: string, boardName: string) => {
    const confirmed = await openConfirmModal({
      title: "Delete Board",
      description: `Are you sure you want to delete "${boardName}"? This action cannot be undone.`,
      actionLabel: "Delete",
      color: "danger",
    });

    if (!confirmed) {
      return;
    }

    try {
      await BoardManager.deleteBoard(boardId);
      if (boardId === currentBoardId) {
        setCurrentBoardId(null);
        // Switch back to local storage mode
        window.location.reload();
      }
    } catch (error: any) {
      console.error("Failed to delete board:", error);
      alert(error.message || "Failed to delete board");
    }
  };

  const handleLogout = async () => {
    const confirmed = await openConfirmModal({
      title: "Sign Out",
      description:
        "Are you sure you want to sign out? You'll need to sign in again to access your boards.",
      actionLabel: "Sign Out",
      color: "danger",
    });

    if (!confirmed) {
      return;
    }

    try {
      // Save current board before logging out - wait for save to complete
      if (currentBoardId) {
        try {
          const { LocalData } = await import("../data/LocalData");
          await LocalData.flushSave();
          // Additional wait to ensure Google Drive API completes
          await new Promise((resolve) => setTimeout(resolve, 300));
        } catch (error) {
          console.warn("Failed to save before logout:", error);
        }
      }

      GoogleDriveService.signOut();
      setCurrentBoardId(null);

      // Reload to switch back to local storage mode
      window.location.reload();
    } catch (error: any) {
      console.error("Failed to sign out:", error);
      alert(error.message || "Failed to sign out");
    }
  };

  if (!auth.isAuthenticated) {
    return (
      <>
        <Sidebar.Tab tab="boards">
          <div className="board-management">
            <div className="board-management-empty">
              {LibraryIcon}
              <p>
                Sign in with Google to create and manage multiple whiteboards
              </p>
              <ToolButton
                onClick={() => setIsAuthDialogOpen(true)}
                type="button"
                aria-label="Sign in with Google"
                showAriaLabel={false}
                className="board-management-signin-button"
              >
                <span className="board-management-signin-button-content">
                  {loginIcon}
                  <span>Sign in with Google</span>
                </span>
              </ToolButton>
            </div>
          </div>
        </Sidebar.Tab>
        <GoogleAuthDialog
          isOpen={isAuthDialogOpen}
          onClose={() => setIsAuthDialogOpen(false)}
          onSuccess={() => {
            BoardManager.refreshBoardsList();
          }}
        />
      </>
    );
  }

  return (
    <Sidebar.Tab tab="boards">
      <div className="board-management">
        <div className="board-management-header">
          <h3>My Boards</h3>
          <ToolButton
            onClick={handleCreateBoard}
            type="button"
            aria-label={isCreatingBoard ? "Creating..." : "New Board"}
            showAriaLabel={false}
            disabled={isCreatingBoard}
            className="board-management-new-board-button"
          >
            <span className="board-management-new-board-button-content">
              {PlusIcon}
              <span>{isCreatingBoard ? "Creating..." : "New Board"}</span>
            </span>
          </ToolButton>
        </div>

        <div className="board-management-list">
          {boards.length === 0 ? (
            <div className="board-management-empty-list">
              <p>No boards yet. Create your first board!</p>
            </div>
          ) : (
            <ul>
              {boards.map((board) => (
                <li
                  key={board.id}
                  className={
                    board.id === currentBoardId
                      ? "board-item active"
                      : "board-item"
                  }
                >
                  <button
                    className="board-item-button"
                    onClick={() => handleSwitchBoard(board.id)}
                    title={board.name}
                  >
                    {LibraryIcon}
                    <span className="board-item-name">{board.name}</span>
                  </button>
                  <div className="board-item-actions">
                    <button
                      className="board-item-rename"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRenameBoard(board.id, board.name);
                      }}
                      title="Rename board"
                    >
                      {pencilIcon}
                    </button>
                    <button
                      className="board-item-delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteBoard(board.id, board.name);
                      }}
                      title="Delete board"
                    >
                      {TrashIcon}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="board-management-footer">
          <div className="board-management-user">
            <span
              className="board-management-user-email"
              title={auth.userEmail || ""}
            >
              {auth.userEmail}
            </span>
          </div>
          <ToolButton
            onClick={handleLogout}
            type="button"
            aria-label="Sign Out"
            showAriaLabel={false}
            className="board-management-logout-button"
          >
            {loginIcon}
            <span>Sign Out</span>
          </ToolButton>
        </div>
      </div>
    </Sidebar.Tab>
  );
};

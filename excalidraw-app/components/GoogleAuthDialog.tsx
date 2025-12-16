import React, { useState, useEffect } from "react";
import { Dialog } from "@excalidraw/excalidraw/components/Dialog";
import DialogActionButton from "@excalidraw/excalidraw/components/DialogActionButton";
import { loginIcon } from "@excalidraw/excalidraw/components/icons";
import { serializeAsJSON } from "@excalidraw/excalidraw/data/json";
import { useAtomValue } from "excalidraw-app/app-jotai";

import { googleDriveAuthAtom } from "../app-jotai";
import { GoogleDriveService } from "../data/GoogleDrive";
import { BoardManager } from "../data/BoardManager";
import { importFromLocalStorage } from "../data/localStorage";

import "./GoogleAuthDialog.scss";

interface GoogleAuthDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const GoogleAuthDialog: React.FC<GoogleAuthDialogProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const auth = useAtomValue(googleDriveAuthAtom);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && auth.isAuthenticated) {
      onSuccess?.();
      onClose();
    }
  }, [isOpen, auth.isAuthenticated, onSuccess, onClose]);

  const handleSignIn = async () => {
    setIsLoading(true);
    setError(null);

    try {
      await GoogleDriveService.initialize();
      const authResult = await GoogleDriveService.authenticate();

      // Initialize board manager after successful auth
      if (authResult.accessToken) {
        await BoardManager.initialize();

        const boards = BoardManager.getAllBoards();
        const localData = importFromLocalStorage(null); // Check shared localStorage

        // If no boards exist, create a default board and migrate localStorage data
        if (boards.length === 0) {
          const defaultBoard = await BoardManager.createBoard("");
          // Set as current board (this will also persist it)
          await BoardManager.switchBoard(defaultBoard.id);

          // Migrate localStorage data to the new board if it exists
          if (
            localData.elements &&
            localData.elements.length > 0 &&
            localData.appState
          ) {
            const jsonData = serializeAsJSON(
              localData.elements,
              localData.appState,
              {},
              "local",
            );
            await GoogleDriveService.saveBoard(
              authResult.accessToken,
              defaultBoard.id,
              jsonData,
            );
          }
        } else if (
          localData.elements &&
          localData.elements.length > 0 &&
          localData.appState
        ) {
          // User has existing boards but also has data in shared localStorage
          // Prompt user to create a new board from current canvas
          const shouldCreateBoard = window.confirm(
            "You have unsaved work in your current canvas. Would you like to create a new board from it?",
          );
          if (shouldCreateBoard) {
            const newBoard = await BoardManager.createBoard("My Canvas");
            await BoardManager.switchBoard(newBoard.id);

            const jsonData = serializeAsJSON(
              localData.elements,
              localData.appState,
              {},
              "local",
            );
            await GoogleDriveService.saveBoard(
              authResult.accessToken,
              newBoard.id,
              jsonData,
            );
          }
        }

        onSuccess?.();
        onClose();
      }
    } catch (err: any) {
      console.error("Google authentication error:", err);
      let errorMessage =
        err?.message ||
        err?.error ||
        "Failed to authenticate with Google. Please check your browser console for details.";

      // Provide more helpful error messages
      if (errorMessage.includes("Failed to load Google Identity Services")) {
        errorMessage =
          "Failed to load Google Identity Services. Please check:\n" +
          "• Your Client ID is a Web Client ID (not OAuth consent screen only)\n" +
          "• Browser extensions aren't blocking the script\n" +
          "• Your network connection is working\n" +
          "• Check browser console for more details";
      } else if (errorMessage.includes("Client ID not configured")) {
        errorMessage =
          "Google Client ID not configured. Please set VITE_GOOGLE_CLIENT_ID in your .env.development file.";
      }

      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = () => {
    GoogleDriveService.signOut();
    onClose();
  };

  if (!isOpen) {
    return null;
  }

  return (
    <Dialog onCloseRequest={onClose} title="Google Drive Integration">
      <div style={{ padding: "1rem", minWidth: "300px" }}>
        {auth.isAuthenticated ? (
          <div>
            <p style={{ marginBottom: "1rem" }}>
              Signed in as: <strong>{auth.userEmail}</strong>
            </p>
            <div className="google-auth-dialog-buttons">
              <DialogActionButton
                label="Sign Out"
                onClick={handleSignOut}
                actionType="danger"
              />
            </div>
          </div>
        ) : (
          <div>
            <p style={{ marginBottom: "1rem" }}>
              Sign in with Google to save your whiteboards to Google Drive and
              create multiple boards.
            </p>
            {error && (
              <div
                style={{
                  padding: "0.75rem",
                  marginBottom: "1rem",
                  backgroundColor: "var(--color-danger)",
                  color: "var(--color-danger-text)",
                  borderRadius: "4px",
                  whiteSpace: "pre-line",
                  fontSize: "0.9rem",
                  lineHeight: "1.4",
                }}
              >
                {error}
              </div>
            )}
            <div className="google-auth-dialog-buttons">
              <DialogActionButton label="Cancel" onClick={onClose} />
              <DialogActionButton
                label={isLoading ? "Signing in..." : "Sign in with Google"}
                onClick={handleSignIn}
                actionType="primary"
                isLoading={isLoading}
                disabled={isLoading}
              >
                {loginIcon}
              </DialogActionButton>
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
};

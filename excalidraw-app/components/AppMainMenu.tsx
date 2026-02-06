import {
  loginIcon,
  ExcalLogo,
  eyeIcon,
  LibraryIcon,
} from "@excalidraw/excalidraw/components/icons";
import { MainMenu } from "@excalidraw/excalidraw/index";
import React, { useState } from "react";

import { isDevEnv } from "@excalidraw/common";

import type { Theme } from "@excalidraw/element/types";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { LanguageList } from "../app-language/LanguageList";
import { isExcalidrawPlusSignedUser } from "../app_constants";
import { useAtomValue } from "../app-jotai";
import { googleDriveAuthAtom } from "../app-jotai";
import { BoardManager } from "../data/BoardManager";

import { GoogleAuthDialog } from "./GoogleAuthDialog";

import { saveDebugState } from "./DebugCanvas";

export const AppMainMenu: React.FC<{
  onCollabDialogOpen: () => any;
  isCollaborating: boolean;
  isCollabEnabled: boolean;
  theme: Theme | "system";
  setTheme: (theme: Theme | "system") => void;
  refresh: () => void;
  excalidrawAPI: ExcalidrawImperativeAPI | null;
}> = React.memo((props) => {
  const auth = useAtomValue(googleDriveAuthAtom);
  const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(false);
  const [isCreatingBoard, setIsCreatingBoard] = useState(false);

  const handleOpenCanvasManager = () => {
    if (props.excalidrawAPI) {
      props.excalidrawAPI.updateScene({
        appState: {
          openSidebar: { name: "default", tab: "boards" },
        },
      });
    }
  };

  const handleNewWhiteboard = async () => {
    if (!auth.isAuthenticated) {
      setIsAuthDialogOpen(true);
      return;
    }

    setIsCreatingBoard(true);
    try {
      // Save current board before creating a new one
      try {
        const { LocalData } = await import("../data/LocalData");
        await LocalData.flushSave();
        await new Promise((resolve) => setTimeout(resolve, 300));
      } catch (error) {
        console.warn("Failed to save before creating new board:", error);
      }

      await BoardManager.initialize();
      const board = await BoardManager.createBoard("");
      await BoardManager.switchBoard(board.id);
      // Reload to switch to new board
      window.location.reload();
    } catch (error: any) {
      console.error("Failed to create board:", error);
      alert(error.message || "Failed to create board");
    } finally {
      setIsCreatingBoard(false);
    }
  };

  return (
    <>
      <MainMenu>
        <MainMenu.DefaultItems.LoadScene />
        <MainMenu.DefaultItems.SaveToActiveFile />
        <MainMenu.DefaultItems.Export />
        <MainMenu.DefaultItems.SaveAsImage />
        {props.isCollabEnabled && (
          <MainMenu.DefaultItems.LiveCollaborationTrigger
            isCollaborating={props.isCollaborating}
            onSelect={() => props.onCollabDialogOpen()}
          />
        )}
        <MainMenu.DefaultItems.CommandPalette className="highlighted" />
        <MainMenu.DefaultItems.SearchMenu />
        <MainMenu.DefaultItems.Help />
        <MainMenu.DefaultItems.ClearCanvas />
        <MainMenu.Separator />
        {auth.isAuthenticated ? (
          <MainMenu.Item icon={LibraryIcon} onSelect={handleOpenCanvasManager}>
            Canvas Manager
          </MainMenu.Item>
        ) : (
          <MainMenu.Item icon={LibraryIcon} onSelect={handleNewWhiteboard}>
            {isCreatingBoard ? "Creating..." : "New Whiteboard"}
          </MainMenu.Item>
        )}
        <MainMenu.Separator />
        <MainMenu.ItemLink
          icon={ExcalLogo}
          href={`${
            import.meta.env.VITE_APP_PLUS_LP
          }/plus?utm_source=excalidraw&utm_medium=app&utm_content=hamburger`}
          className=""
        >
          Excalidraw+
        </MainMenu.ItemLink>
        <MainMenu.DefaultItems.Socials />
        {!auth.isAuthenticated && (
          <MainMenu.ItemLink
            icon={loginIcon}
            href={`${import.meta.env.VITE_APP_PLUS_APP}${
              isExcalidrawPlusSignedUser ? "" : "/sign-up"
            }?utm_source=signin&utm_medium=app&utm_content=hamburger`}
            className="highlighted"
          >
            {isExcalidrawPlusSignedUser ? "Sign in" : "Sign up"}
          </MainMenu.ItemLink>
        )}
        {isDevEnv() && (
          <MainMenu.Item
            icon={eyeIcon}
            onClick={() => {
              if (window.visualDebug) {
                delete window.visualDebug;
                saveDebugState({ enabled: false });
              } else {
                window.visualDebug = { data: [] };
                saveDebugState({ enabled: true });
              }
              props?.refresh();
            }}
          >
            Visual Debug
          </MainMenu.Item>
        )}
        <MainMenu.Separator />
        <MainMenu.DefaultItems.ToggleTheme
          allowSystemTheme
          theme={props.theme}
          onSelect={props.setTheme}
        />
        <MainMenu.ItemCustom>
          <LanguageList style={{ width: "100%" }} />
        </MainMenu.ItemCustom>
        <MainMenu.DefaultItems.ChangeCanvasBackground />
      </MainMenu>
      <GoogleAuthDialog
        isOpen={isAuthDialogOpen}
        onClose={() => setIsAuthDialogOpen(false)}
        onSuccess={() => {
          BoardManager.refreshBoardsList();
        }}
      />
    </>
  );
});

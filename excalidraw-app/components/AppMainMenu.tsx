import React, { useState } from "react";
import { MainMenu } from "@excalidraw/excalidraw/index";
import { ExcalLogo, eyeIcon, loginIcon, TrashIcon } from "../../packages/excalidraw/components/icons";
import { isDevEnv } from "@excalidraw/common";
import { LanguageList } from "../app-language/LanguageList";
import { isExcalidrawPlusSignedUser } from "../app_constants";
import { saveDebugState } from "./DebugCanvas";
import type { Theme } from "@excalidraw/element/types";

export const AppMainMenu: React.FC<{
  onCollabDialogOpen: () => any;
  isCollaborating: boolean;
  isCollabEnabled: boolean;
  theme: Theme | "system";
  setTheme: (theme: Theme | "system") => void;
  refresh: () => void;
  excalidrawAPI: any;
}> = React.memo((props) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleClearCanvas = () => {
    setIsDialogOpen(true);
  };

  const confirmClearCanvas = () => {
    if (props.excalidrawAPI) {
      props.excalidrawAPI.updateScene({ elements: [] });
    }
    setIsDialogOpen(false);
  };

  const cancelClearCanvas = () => {
    setIsDialogOpen(false);
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
        <MainMenu.Item icon={TrashIcon} onClick={handleClearCanvas}>
          Clear Canvas
        </MainMenu.Item>
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
        <MainMenu.ItemLink
          icon={loginIcon}
          href={`${import.meta.env.VITE_APP_PLUS_APP}${
            isExcalidrawPlusSignedUser ? "" : "/sign-up"
          }?utm_source=signin&utm_medium=app&utm_content=hamburger`}
          className="highlighted"
        >
          {isExcalidrawPlusSignedUser ? "Sign in" : "Sign up"}
        </MainMenu.ItemLink>
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

      {isDialogOpen && (
        <div className="confirm-dialog">
          <div className="confirm-dialog-content">
            <h3>Clear Canvas</h3>
            <p>Are you sure you want to clear the canvas? This action cannot be undone.</p>
            <button onClick={confirmClearCanvas}>Confirm</button>
            <button onClick={cancelClearCanvas}>Cancel</button>
          </div>
        </div>
      )}
    </>
  );
});

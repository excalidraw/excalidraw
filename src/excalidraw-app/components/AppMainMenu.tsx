import React from "react";
import { MainMenu } from "../../packages/excalidraw/index";

export const AppMainMenu: React.FC<{
  setCollabDialogShown: (toggle: boolean) => any;
  isCollaborating: boolean;
}> = React.memo((props) => {
  return (
    <MainMenu>
      <MainMenu.DefaultItems.LoadScene />
      <MainMenu.DefaultItems.SaveToActiveFile />
      <MainMenu.DefaultItems.Export />
      <MainMenu.DefaultItems.SaveAsImage />
      {/* <MainMenu.DefaultItems.LiveCollaborationTrigger
        isCollaborating={props.isCollaborating}
        onSelect={() => props.setCollabDialogShown(true)}
      /> */}

      <MainMenu.DefaultItems.Help />
      <MainMenu.DefaultItems.ClearCanvas />
      <MainMenu.Separator />

      <MainMenu.DefaultItems.Socials />
      <MainMenu.Separator />
      <MainMenu.DefaultItems.ToggleTheme />
      <MainMenu.DefaultItems.ChangeCanvasBackground />
    </MainMenu>
  );
});

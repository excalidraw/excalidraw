import React from "react";
import { PlusPromoIcon } from "../../src/components/icons";
import { MainMenu } from "../../src/packages/excalidraw/index";
import { LanguageList } from "./LanguageList";

export const AppMainMenu: React.FC<{
  setCollabDialogShown: (toggle: boolean) => any;
  isCollaborating: boolean;
  isCollabEnabled: boolean;
}> = React.memo((props) => {
  return (
    <MainMenu>
      <MainMenu.DefaultItems.LoadScene />
      <MainMenu.DefaultItems.SaveToActiveFile />
      <MainMenu.DefaultItems.Export />
      <MainMenu.DefaultItems.SaveAsImage />
      {props.isCollabEnabled && (
        <MainMenu.DefaultItems.LiveCollaborationTrigger
          isCollaborating={props.isCollaborating}
          onSelect={() => props.setCollabDialogShown(true)}
        />
      )}

      <MainMenu.DefaultItems.Help />
      <MainMenu.DefaultItems.ClearCanvas />
      <MainMenu.Separator />
      <MainMenu.ItemLink
        icon={PlusPromoIcon}
        href={`${
          import.meta.env.VITE_APP_PLUS_LP
        }/plus?utm_source=excalidraw&utm_medium=app&utm_content=hamburger`}
        className="ExcalidrawPlus"
      >
        Excalidraw+
      </MainMenu.ItemLink>
      <MainMenu.DefaultItems.Socials />
      <MainMenu.Separator />
      <MainMenu.DefaultItems.ToggleTheme />
      <MainMenu.ItemCustom>
        <LanguageList style={{ width: "100%" }} />
      </MainMenu.ItemCustom>
      <MainMenu.DefaultItems.ChangeCanvasBackground />
    </MainMenu>
  );
});

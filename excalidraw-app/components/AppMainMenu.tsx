import React from "react";
import {
  PlusPromoIcon,
  command,
} from "../../packages/excalidraw/components/icons";
import { MainMenu } from "../../packages/excalidraw/index";
import { LanguageList } from "./LanguageList";
import { getShortcutFromShortcutName } from "../../packages/excalidraw/actions/shortcuts";
import { t } from "../../packages/excalidraw/i18n";

export const AppMainMenu: React.FC<{
  onCollabDialogOpen: () => any;
  toggleCommandPalette: () => void;
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
          onSelect={() => props.onCollabDialogOpen()}
        />
      )}

      <MainMenu.Item
        icon={command}
        onSelect={() => props.toggleCommandPalette()}
        shortcut={getShortcutFromShortcutName("commandPalette")}
      >
        {t("commandPalette.title")}
      </MainMenu.Item>
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

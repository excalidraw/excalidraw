import {
  eyeIcon,
  gridIcon,
  LoadIcon,
} from "@excalidraw/excalidraw/components/icons";
import { useI18n } from "@excalidraw/excalidraw/i18n";
import { MainMenu } from "@excalidraw/excalidraw/index";
import React from "react";

import { isDevEnv } from "@excalidraw/common";

import type { Theme } from "@excalidraw/element/types";

import { LanguageList } from "../app-language/LanguageList";

import { saveDebugState } from "./DebugCanvas";

const formatRoomDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const getRoomDate = (daysAgo: number) => {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);

  return formatRoomDate(date);
};

const navigateToRoom = (date: string) => {
  window.location.href = `/room/${date}`;
};

export const AppMainMenu: React.FC<{
  theme: Theme | "system";
  refresh: () => void;
}> = React.memo((props) => {
  const { t } = useI18n();
  const today = getRoomDate(0);
  const archiveDates = Array.from({ length: 7 }, (_, index) =>
    getRoomDate(index + 1),
  );

  return (
    <MainMenu>
      <MainMenu.Item
        icon={gridIcon}
        selected={window.location.pathname === `/room/${today}`}
        onSelect={() => navigateToRoom(today)}
      >
        {t("shangban.menu.todayBoard")}
      </MainMenu.Item>
      <MainMenu.Sub>
        <MainMenu.Sub.Trigger icon={LoadIcon}>
          {t("shangban.menu.archiveReadOnly")}
        </MainMenu.Sub.Trigger>
        <MainMenu.Sub.Content>
          {archiveDates.map((date) => (
            <MainMenu.Item
              key={date}
              selected={window.location.pathname === `/room/${date}`}
              onSelect={() => navigateToRoom(date)}
            >
              {date}
            </MainMenu.Item>
          ))}
        </MainMenu.Sub.Content>
      </MainMenu.Sub>
      <MainMenu.Separator />
      <MainMenu.DefaultItems.SaveAsImage />
      <MainMenu.DefaultItems.CommandPalette className="highlighted" />
      <MainMenu.DefaultItems.SearchMenu />
      <MainMenu.DefaultItems.Help />
      <MainMenu.DefaultItems.ClearCanvas />
      <MainMenu.Separator />
      <MainMenu.DefaultItems.Socials />
      {isDevEnv() && (
        <MainMenu.Item
          icon={eyeIcon}
          onSelect={() => {
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
      <MainMenu.DefaultItems.Preferences />
      <MainMenu.DefaultItems.ToggleTheme allowSystemTheme theme={props.theme} />
      <MainMenu.ItemCustom>
        <LanguageList style={{ width: "100%" }} />
      </MainMenu.ItemCustom>
      <MainMenu.DefaultItems.ChangeCanvasBackground />
    </MainMenu>
  );
});

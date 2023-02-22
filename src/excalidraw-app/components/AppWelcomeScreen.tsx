import React from "react";
import { PlusPromoIcon } from "../../components/icons";
import { useI18n } from "../../i18n";
import { WelcomeScreen } from "../../packages/excalidraw/index";
import { isExcalidrawPlusSignedUser } from "../app_constants";

export const AppWelcomeScreen: React.FC<{
  setCollabDialogShown: (toggle: boolean) => any;
}> = React.memo((props) => {
  const { t } = useI18n();
  let headingContent;

  if (isExcalidrawPlusSignedUser) {
    headingContent = t("welcomeScreen.app.center_heading_plus")
      .split(/(Excalidraw\+)/)
      .map((bit, idx) => {
        if (bit === "Excalidraw+") {
          return (
            <a
              style={{ pointerEvents: "all" }}
              href={`${process.env.REACT_APP_PLUS_APP}?utm_source=excalidraw&utm_medium=app&utm_content=welcomeScreenSignedInUser`}
              key={idx}
            >
              Excalidraw+
            </a>
          );
        }
        return bit;
      });
  } else {
    headingContent = t("welcomeScreen.app.center_heading");
  }

  return (
    <WelcomeScreen>
      <WelcomeScreen.Hints.MenuHint>
        {t("welcomeScreen.app.menuHint")}
      </WelcomeScreen.Hints.MenuHint>
      <WelcomeScreen.Hints.ToolbarHint />
      <WelcomeScreen.Hints.HelpHint />
      <WelcomeScreen.Center>
        <WelcomeScreen.Center.Logo />
        <WelcomeScreen.Center.Heading>
          {headingContent}
        </WelcomeScreen.Center.Heading>
        <WelcomeScreen.Center.Menu>
          <WelcomeScreen.Center.MenuItemLoadScene />
          <WelcomeScreen.Center.MenuItemHelp />
          <WelcomeScreen.Center.MenuItemLiveCollaborationTrigger
            onSelect={() => props.setCollabDialogShown(true)}
          />
          {!isExcalidrawPlusSignedUser && (
            <WelcomeScreen.Center.MenuItemLink
              href="https://plus.excalidraw.com/plus?utm_source=excalidraw&utm_medium=app&utm_content=welcomeScreenGuest"
              shortcut={null}
              icon={PlusPromoIcon}
            >
              Try Excalidraw Plus!
            </WelcomeScreen.Center.MenuItemLink>
          )}
        </WelcomeScreen.Center.Menu>
      </WelcomeScreen.Center>
    </WelcomeScreen>
  );
});

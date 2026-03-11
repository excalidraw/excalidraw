import { POINTER_EVENTS } from "@excalidraw/common";
import { useI18n } from "@excalidraw/excalidraw/i18n";
import { WelcomeScreen } from "@excalidraw/excalidraw/index";
import React from "react";

export const AppWelcomeScreen: React.FC<{
  onCollabDialogOpen: () => any;
  isCollabEnabled: boolean;
  onStartFromTemplate?: () => void;
}> = React.memo((props) => {
  const { t } = useI18n();

  const headingContent = (
    <>
      Excalidraw with{" "}
      <a
        href="https://developer.luzmo.com/guide/guides--creating-a-column-flex-chart"
        target="_blank"
        rel="noopener noreferrer"
        style={{ pointerEvents: POINTER_EVENTS.inheritFromUI }}
      >
        Luzmo's Flex Charts
      </a>
      <br />
      <span style={{ fontSize: "0.9em", opacity: 0.9 }}>
        Select the chart type from the toolbar
      </span>
      <br />
      <br />
      <span style={{ fontSize: "0.7em", opacity: 0.9 }}>
        Built on the shoulders of a giant — a fork of{" "}
        <a
          href="https://excalidraw.com"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            pointerEvents: POINTER_EVENTS.inheritFromUI,
            fontWeight: "bold",
            fontSize: "1.15em",
            textShadow: "0 1px 2px rgba(96,59,231,0.14)",
            padding: "0 2px",
          }}
        >
          Excalidraw
        </a>
      </span>
    </>
  );

  return (
    <WelcomeScreen>
      <WelcomeScreen.Hints.MenuHint>
        {t("welcomeScreen.defaults.menuHint")}
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
          {props.onStartFromTemplate && (
            <WelcomeScreen.Center.MenuItemStartFromTemplate
              onSelect={props.onStartFromTemplate}
            />
          )}
          <WelcomeScreen.Center.MenuItemHelp />
          {props.isCollabEnabled && (
            <WelcomeScreen.Center.MenuItemLiveCollaborationTrigger
              onSelect={() => props.onCollabDialogOpen()}
            />
          )}
        </WelcomeScreen.Center.Menu>
      </WelcomeScreen.Center>
    </WelcomeScreen>
  );
});

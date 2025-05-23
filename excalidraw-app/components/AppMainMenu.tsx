import {
  loginIcon,
  ExcalLogo,
  eyeIcon,
  pngIcon,
} from "@excalidraw/excalidraw/components/icons";
import { MainMenu } from "@excalidraw/excalidraw/index";
import React from "react";

import { getVersion, isDevEnv } from "@excalidraw/common";
import { fileOpen, fileSave } from "@excalidraw/excalidraw/data/filesystem";
import superjson from "superjson";
import { getDefaultAppState } from "@excalidraw/excalidraw/appState";

import type { Theme } from "@excalidraw/element/types";
import type {
  AppState,
  ExcalidrawImperativeAPI,
} from "@excalidraw/excalidraw/types";

import { LanguageList } from "../app-language/LanguageList";
import { isExcalidrawPlusSignedUser } from "../app_constants";

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
      <MainMenu.DefaultItems.CommandPalette className="highlighted" />
      <MainMenu.DefaultItems.SearchMenu />
      <MainMenu.DefaultItems.Help />
      <MainMenu.DefaultItems.ClearCanvas />
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
        <>
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
          {props.excalidrawAPI && (
            <>
              <MainMenu.Separator />
              <MainMenu.Item
                icon={pngIcon}
                onClick={async () => {
                  const blob = await fileOpen({
                    description: "Excalidraw test case recording",
                    extensions: ["json"],
                  });
                  const text = await blob.text();
                  const recording = superjson.parse<any>(text);

                  window.setRecordedDataRef(null);

                  const start = recording.shift();

                  window.resizeTo(
                    start.dimensions.innerWidth,
                    start.dimensions.innerHeight,
                  );
                  if (
                    Math.abs(start.dimensions.innerWidth - window.innerWidth) >
                      1 ||
                    Math.abs(
                      start.dimensions.innerHeight - window.innerHeight,
                    ) > 1
                  ) {
                    console.error("Window dimensions do not match");
                    return;
                  }

                  props.excalidrawAPI!.resetScene();
                  props.excalidrawAPI!.updateScene({
                    elements: superjson.parse(start.scene),
                    appState: {
                      ...getDefaultAppState(),
                      ...superjson.parse<AppState>(start.state),
                    },
                  });

                  let lastTime = start.time;
                  for (const item of recording) {
                    if (item.type === "event") {
                      const { time, type, name, ...rest } = item;
                      const delay = time - lastTime;
                      lastTime = time;
                      await new Promise((resolve) =>
                        setTimeout(resolve, delay),
                      );
                      console.log(type, name, rest);
                      window.runReplay(name, rest);
                    }
                  }
                }}
              >
                Run Recording...
              </MainMenu.Item>
              <MainMenu.Item
                icon={pngIcon}
                onClick={async () => {
                  window.setRecordedDataRef([
                    {
                      time: new Date().getTime(),
                      type: "start",
                      excalidrawVersion: getVersion(),
                      dimensions: {
                        innerWidth: window.innerWidth,
                        innerHeight: window.innerHeight,
                      },
                      chromeVersion: window.navigator.userAgent
                        .split(" ")
                        .find((v) => v.startsWith("Chrome/"))
                        ?.substring(7),
                      state: superjson.stringify(
                        props.excalidrawAPI!.getAppState(),
                      ),
                      scene: superjson.stringify(
                        props.excalidrawAPI!.getSceneElementsIncludingDeleted(),
                      ),
                    },
                  ]);
                }}
              >
                Start Recording
              </MainMenu.Item>
              <MainMenu.Item
                icon={pngIcon}
                onClick={async () => {
                  const blob = new Blob(
                    [superjson.stringify(window.getRecordedDataRef())],
                    {
                      type: "text/json",
                    },
                  );

                  try {
                    await fileSave(blob, {
                      name: `testcase-${new Date().getTime()}${Math.floor(
                        Math.random() * 10000,
                      )}`,
                      extension: "json",
                      description: "Excalidraw test case recording",
                    });
                  } catch (error) {}
                }}
              >
                Save Recording...
              </MainMenu.Item>
            </>
          )}
        </>
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
  );
});

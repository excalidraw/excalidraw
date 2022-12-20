import { useAtom } from "jotai";
import { actionLoadScene, actionShortcuts } from "../actions";
import { ActionManager } from "../actions/manager";
import { getShortcutFromShortcutName } from "../actions/shortcuts";
import { isExcalidrawPlusSignedUser } from "../constants";
import { collabDialogShownAtom } from "../excalidraw-app/collab/Collab";
import { t } from "../i18n";
import { AppState } from "../types";
import {
  ExcalLogo,
  HelpIcon,
  LoadIcon,
  PlusPromoIcon,
  UsersIcon,
} from "./icons";
import "./WelcomeScreen.scss";

const WelcomeScreenItem = ({
  label,
  shortcut,
  onClick,
  icon,
  link,
}: {
  label: string;
  shortcut: string | null;
  onClick?: () => void;
  icon: JSX.Element;
  link?: string;
}) => {
  if (link) {
    return (
      <a
        className="WelcomeScreen-item"
        href={link}
        target="_blank"
        rel="noreferrer"
      >
        <div className="WelcomeScreen-item__label">
          {icon}
          {label}
        </div>
      </a>
    );
  }

  return (
    <button className="WelcomeScreen-item" type="button" onClick={onClick}>
      <div className="WelcomeScreen-item__label">
        {icon}
        {label}
      </div>
      {shortcut && (
        <div className="WelcomeScreen-item__shortcut">{shortcut}</div>
      )}
    </button>
  );
};

const WelcomeScreen = ({
  appState,
  actionManager,
}: {
  appState: AppState;
  actionManager: ActionManager;
}) => {
  const [, setCollabDialogShown] = useAtom(collabDialogShownAtom);

  let subheadingJSX;

  if (isExcalidrawPlusSignedUser) {
    subheadingJSX = t("welcomeScreen.switchToPlusApp")
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
    subheadingJSX = t("welcomeScreen.data");
  }

  return (
    <div className="WelcomeScreen-container">
      <div className="WelcomeScreen-logo virgil WelcomeScreen-decor">
        {ExcalLogo} Excalidraw
      </div>
      <div className="virgil WelcomeScreen-decor WelcomeScreen-decor--subheading">
        {subheadingJSX}
      </div>
      <div className="WelcomeScreen-items">
        {!appState.viewModeEnabled && (
          <WelcomeScreenItem
            // TODO barnabasmolnar/editor-redesign
            // do we want the internationalized labels here that are currently
            // in use elsewhere or new ones?
            label={t("buttons.load")}
            onClick={() => actionManager.executeAction(actionLoadScene)}
            shortcut={getShortcutFromShortcutName("loadScene")}
            icon={LoadIcon}
          />
        )}
        <WelcomeScreenItem
          label={t("labels.liveCollaboration")}
          shortcut={null}
          onClick={() => setCollabDialogShown(true)}
          icon={UsersIcon}
        />
        <WelcomeScreenItem
          onClick={() => actionManager.executeAction(actionShortcuts)}
          label={t("helpDialog.title")}
          shortcut="?"
          icon={HelpIcon}
        />
        {!isExcalidrawPlusSignedUser && (
          <WelcomeScreenItem
            link="https://plus.excalidraw.com/plus?utm_source=excalidraw&utm_medium=app&utm_content=welcomeScreenGuest"
            label="Try Excalidraw Plus!"
            shortcut={null}
            icon={PlusPromoIcon}
          />
        )}
      </div>
    </div>
  );
};

export default WelcomeScreen;

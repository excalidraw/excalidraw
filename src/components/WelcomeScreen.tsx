import { useAtom } from "jotai";
import { actionLoadScene, actionShortcuts } from "../actions";
import { ActionManager } from "../actions/manager";
import { getShortcutFromShortcutName } from "../actions/shortcuts";
import { COOKIES } from "../constants";
import { collabDialogShownAtom } from "../excalidraw-app/collab/Collab";
import { t } from "../i18n";
import {
  ExcalLogo,
  HelpIcon,
  LoadIcon,
  PlusPromoIcon,
  UsersIcon,
} from "./icons";
import "./WelcomeScreen.scss";

const isExcalidrawPlusSignedUser = document.cookie.includes(
  COOKIES.AUTH_STATE_COOKIE,
);

const WelcomeScreenItem = ({
  label,
  shortcut,
  onClick,
  icon,
  isPromoLink,
}: {
  label: string;
  shortcut: string | null;
  onClick?: () => void;
  icon: JSX.Element;
  isPromoLink?: boolean;
}) => {
  if (isPromoLink) {
    return (
      <a
        className="WelcomeScreen-item WelcomeScreen-item--promo"
        href="https://plus.excalidraw.com/plus?utm_source=excalidraw&utm_medium=app&utm_content=welcomeScreenGuest"
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

const WelcomeScreen = ({ actionManager }: { actionManager: ActionManager }) => {
  const [, setCollabDialogShown] = useAtom(collabDialogShownAtom);

  return (
    <div className="WelcomeScreen-container">
      <div className="WelcomeScreen-logo virgil WelcomeScreen-decor">
        {ExcalLogo} Excalidraw
      </div>
      <div className="virgil WelcomeScreen-decor WelcomeScreen-decor--data">
        {t("welcomeScreen.data")}
      </div>
      <div className="WelcomeScreen-items">
        <WelcomeScreenItem
          // TODO barnabasmolnar/editor-redesign
          // do we want the internationalized labels here that are currently
          // in use elsewhere or new ones?
          label={t("buttons.load")}
          onClick={() => actionManager.executeAction(actionLoadScene)}
          shortcut={getShortcutFromShortcutName("loadScene")}
          icon={LoadIcon}
        />
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
            isPromoLink
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

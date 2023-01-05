import { actionLoadScene, actionShortcuts } from "../actions";
import { getShortcutFromShortcutName } from "../actions/shortcuts";
import { t } from "../i18n";
import { UIWelcomeScreenCenterComponents } from "../types";
import { ReactChildrenToObject } from "../utils";
import { useExcalidrawActionManager, useExcalidrawAppState } from "./App";
import {
  ExcalLogo,
  HelpIcon,
  LoadIcon,
  WelcomeScreenHelpArrow,
  WelcomeScreenMenuArrow,
  WelcomeScreenTopToolbarArrow,
} from "./icons";

import "./WelcomeScreen.scss";

const WelcomeScreenMenuItem = ({
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

const Center = ({ children }: { children?: React.ReactNode }) => {
  const childrenComponents =
    ReactChildrenToObject<UIWelcomeScreenCenterComponents>(
      children ||
        (
          <>
            <Logo />
            <Heading>{t("welcomeScreen.defaults.center_heading")}</Heading>
            <Menu>
              <MenuItemLoadScene />
              <MenuItemHelp />
            </Menu>
          </>
        ).props.children,
    );

  return (
    <div className="WelcomeScreen-container">
      {childrenComponents.Logo}
      {childrenComponents.Heading}
      {childrenComponents.Menu}
    </div>
  );
};
Center.displayName = "Center";

const Logo = ({ children }: { children?: React.ReactNode }) => {
  return (
    <div className="WelcomeScreen-logo virgil WelcomeScreen-decor">
      {children || <>{ExcalLogo} Excalidraw</>}
    </div>
  );
};
Logo.displayName = "Logo";

const Heading = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="virgil WelcomeScreen-decor WelcomeScreen-decor--subheading">
      {children}
    </div>
  );
};
Heading.displayName = "Heading";

const Menu = ({ children }: { children?: React.ReactNode }) => {
  return <div className="WelcomeScreen-items">{children}</div>;
};
Menu.displayName = "Menu";

const MenuItemHelp = () => {
  const actionManager = useExcalidrawActionManager();

  return (
    <WelcomeScreenMenuItem
      onClick={() => actionManager.executeAction(actionShortcuts)}
      label={t("helpDialog.title")}
      shortcut="?"
      icon={HelpIcon}
    />
  );
};
MenuItemHelp.displayName = "MenuItemHelp";

const MenuItemLoadScene = () => {
  const appState = useExcalidrawAppState();
  const actionManager = useExcalidrawActionManager();

  if (appState.viewModeEnabled) {
    return null;
  }

  return (
    <WelcomeScreenMenuItem
      label={t("buttons.load")}
      onClick={() => actionManager.executeAction(actionLoadScene)}
      shortcut={getShortcutFromShortcutName("loadScene")}
      icon={LoadIcon}
    />
  );
};
MenuItemLoadScene.displayName = "MenuItemLoadScene";

const HelpHint = () => {
  return (
    <div className="virgil WelcomeScreen-decor WelcomeScreen-decor--help-pointer">
      <div>{t("welcomeScreen.defaults.helpHint")}</div>
      {WelcomeScreenHelpArrow}
    </div>
  );
};
HelpHint.displayName = "HelpHint";

const MenuHint = ({ children }: { children?: React.ReactNode }) => {
  return (
    <div className="virgil WelcomeScreen-decor WelcomeScreen-decor--menu-pointer">
      {WelcomeScreenMenuArrow}
      <div>{children || t("welcomeScreen.defaults.menuHint")}</div>
    </div>
  );
};
MenuHint.displayName = "MenuHint";

const ToolbarHint = () => {
  return (
    <div className="virgil WelcomeScreen-decor WelcomeScreen-decor--top-toolbar-pointer">
      <div className="WelcomeScreen-decor--top-toolbar-pointer__label">
        {t("welcomeScreen.defaults.toolbarHint")}
      </div>
      {WelcomeScreenTopToolbarArrow}
    </div>
  );
};
ToolbarHint.displayName = "ToolbarHint";

const WelcomeScreen = (props: { children: React.ReactNode }) => {
  // NOTE this component is used as a dummy wrapper to retrieve child props
  // from, and will never be rendered to DOM directly. As such, we can't
  // do anything here (use hooks and such)
  return null;
};
WelcomeScreen.displayName = "WelcomeScreen";

WelcomeScreen.HelpHint = HelpHint;
WelcomeScreen.MenuHint = MenuHint;
WelcomeScreen.ToolbarHint = ToolbarHint;
WelcomeScreen.Center = Center;

Center.Logo = Logo;
Center.Heading = Heading;
Center.Menu = Menu;
Center.MenuItem = WelcomeScreenMenuItem;
Center.MenuItemHelp = MenuItemHelp;
Center.MenuItemLoadScene = MenuItemLoadScene;

export default WelcomeScreen;

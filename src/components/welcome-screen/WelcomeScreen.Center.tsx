import { actionLoadScene, actionShortcuts } from "../../actions";
import { getShortcutFromShortcutName } from "../../actions/shortcuts";
import { t } from "../../i18n";
import {
  useDevice,
  useExcalidrawActionManager,
  useExcalidrawAppState,
} from "../App";
import { useTunnels } from "../../context/tunnels";
import { ExcalLogo, HelpIcon, LoadIcon, usersIcon } from "../icons";

const WelcomeScreenMenuItemContent = ({
  icon,
  shortcut,
  children,
}: {
  icon?: JSX.Element;
  shortcut?: string | null;
  children: React.ReactNode;
}) => {
  const device = useDevice();
  return (
    <>
      <div className="welcome-screen-menu-item__icon">{icon}</div>
      <div className="welcome-screen-menu-item__text">{children}</div>
      {shortcut && !device.isMobile && (
        <div className="welcome-screen-menu-item__shortcut">{shortcut}</div>
      )}
    </>
  );
};
WelcomeScreenMenuItemContent.displayName = "WelcomeScreenMenuItemContent";

const WelcomeScreenMenuItem = ({
  onSelect,
  children,
  icon,
  shortcut,
  className = "",
  ...props
}: {
  onSelect: () => void;
  children: React.ReactNode;
  icon?: JSX.Element;
  shortcut?: string | null;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) => {
  return (
    <button
      {...props}
      type="button"
      className={`welcome-screen-menu-item ${className}`}
      onClick={onSelect}
    >
      <WelcomeScreenMenuItemContent icon={icon} shortcut={shortcut}>
        {children}
      </WelcomeScreenMenuItemContent>
    </button>
  );
};
WelcomeScreenMenuItem.displayName = "WelcomeScreenMenuItem";

const WelcomeScreenMenuItemLink = ({
  children,
  href,
  icon,
  shortcut,
  className = "",
  ...props
}: {
  children: React.ReactNode;
  href: string;
  icon?: JSX.Element;
  shortcut?: string | null;
} & React.AnchorHTMLAttributes<HTMLAnchorElement>) => {
  return (
    <a
      {...props}
      className={`welcome-screen-menu-item ${className}`}
      href={href}
      target="_blank"
      rel="noreferrer"
    >
      <WelcomeScreenMenuItemContent icon={icon} shortcut={shortcut}>
        {children}
      </WelcomeScreenMenuItemContent>
    </a>
  );
};
WelcomeScreenMenuItemLink.displayName = "WelcomeScreenMenuItemLink";

const Center = ({ children }: { children?: React.ReactNode }) => {
  const { WelcomeScreenCenterTunnel } = useTunnels();
  return (
    <WelcomeScreenCenterTunnel.In>
      <div className="welcome-screen-center">
        {children || (
          <>
            <Logo />
            <Heading>{t("welcomeScreen.defaults.center_heading")}</Heading>
            <Menu>
              <MenuItemLoadScene />
              <MenuItemHelp />
            </Menu>
          </>
        )}
      </div>
    </WelcomeScreenCenterTunnel.In>
  );
};
Center.displayName = "Center";

const Logo = ({ children }: { children?: React.ReactNode }) => {
  return (
    <div className="welcome-screen-center__logo virgil welcome-screen-decor">
      {children || <>{ExcalLogo} Excalidraw</>}
    </div>
  );
};
Logo.displayName = "Logo";

const Heading = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="welcome-screen-center__heading welcome-screen-decor virgil">
      {children}
    </div>
  );
};
Heading.displayName = "Heading";

const Menu = ({ children }: { children?: React.ReactNode }) => {
  return <div className="welcome-screen-menu">{children}</div>;
};
Menu.displayName = "Menu";

const MenuItemHelp = () => {
  const actionManager = useExcalidrawActionManager();

  return (
    <WelcomeScreenMenuItem
      onSelect={() => actionManager.executeAction(actionShortcuts)}
      shortcut="?"
      icon={HelpIcon}
    >
      {t("helpDialog.title")}
    </WelcomeScreenMenuItem>
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
      onSelect={() => actionManager.executeAction(actionLoadScene)}
      shortcut={getShortcutFromShortcutName("loadScene")}
      icon={LoadIcon}
    >
      {t("buttons.load")}
    </WelcomeScreenMenuItem>
  );
};
MenuItemLoadScene.displayName = "MenuItemLoadScene";

const MenuItemLiveCollaborationTrigger = ({
  onSelect,
}: {
  onSelect: () => any;
}) => {
  // FIXME when we tie t() to lang state
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const appState = useExcalidrawAppState();

  return (
    <WelcomeScreenMenuItem shortcut={null} onSelect={onSelect} icon={usersIcon}>
      {t("labels.liveCollaboration")}
    </WelcomeScreenMenuItem>
  );
};
MenuItemLiveCollaborationTrigger.displayName =
  "MenuItemLiveCollaborationTrigger";

// -----------------------------------------------------------------------------

Center.Logo = Logo;
Center.Heading = Heading;
Center.Menu = Menu;
Center.MenuItem = WelcomeScreenMenuItem;
Center.MenuItemLink = WelcomeScreenMenuItemLink;
Center.MenuItemHelp = MenuItemHelp;
Center.MenuItemLoadScene = MenuItemLoadScene;
Center.MenuItemLiveCollaborationTrigger = MenuItemLiveCollaborationTrigger;

export { Center };

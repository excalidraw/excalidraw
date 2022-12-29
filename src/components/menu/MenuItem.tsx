import * as MenuComponents from "./MenuDefaultItems";
import MenuSocials from "./MenuSocials";

const MenuItemContent = ({
  icon,
  shortcut,
  label,
}: {
  icon?: JSX.Element;
  shortcut?: string;
  label: string;
}) => {
  return (
    <>
      <div className="menu-item__icon">{icon}</div>
      <div className="menu-item__text">{label}</div>
      {shortcut && <div className="menu-item__shortcut">{shortcut}</div>}
    </>
  );
};

const MenuItem = ({
  icon,
  onClick,
  children,
  dataTestId,
  shortcut,
  className = "",
  link,
  style,
}: {
  icon?: JSX.Element;
  onClick?: () => void;
  children: React.ReactNode;
  dataTestId?: string;
  shortcut?: string;
  className?: string;
  link?: string;
  style?: React.CSSProperties;
}) => {
  if (typeof children === "string") {
    const label = children;
    if (link) {
      return (
        <a
          href={link}
          target="_blank"
          rel="noreferrer"
          className={`menu-item ${className}`}
          style={style}
        >
          <MenuItemContent icon={icon} shortcut={shortcut} label={label} />
        </a>
      );
    }
    return (
      <button
        aria-label={label}
        onClick={onClick}
        data-testid={dataTestId}
        title={label}
        type="button"
        className={`menu-item ${className}`}
        style={style}
      >
        <MenuItemContent icon={icon} shortcut={shortcut} label={label} />
      </button>
    );
  }
  return (
    <div className={`menu-item ${className}`} style={style}>
      {children}
    </div>
  );
};

MenuItem.LoadScene = MenuComponents.LoadScene;
MenuItem.SaveToActiveFile = MenuComponents.SaveToActiveFile;
MenuItem.SaveAsImage = MenuComponents.SaveAsImage;
MenuItem.Help = MenuComponents.Help;
MenuItem.ClearCanvas = MenuComponents.ClearCanvas;
MenuItem.ToggleTheme = MenuComponents.ToggleTheme;
MenuItem.ChangeCanvasBackground = MenuComponents.ChangeCanvasBackground;
MenuItem.Export = MenuComponents.Export;
MenuItem.Socials = MenuSocials;

export default MenuItem;
MenuItem.displayName = "MenuItem";

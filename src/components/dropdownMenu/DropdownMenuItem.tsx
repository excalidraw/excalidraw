import { useDevice } from "../App";

const MenuItemContent = ({
  icon,
  shortcut,
  label,
}: {
  icon?: JSX.Element;
  shortcut?: string;
  label: string;
}) => {
  const device = useDevice();
  return (
    <>
      <div className="dropdown-menu-item__icon">{icon}</div>
      <div className="dropdown-menu-item__text">{label}</div>
      {shortcut && !device.isMobile && (
        <div className="dropdown-menu-item__shortcut">{shortcut}</div>
      )}
    </>
  );
};

const DropdownMenuItem = ({
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
  const classNames = `dropdown-menu-item ${className}`.trim();

  if (typeof children === "string") {
    const label = children;
    if (link) {
      return (
        <a
          href={link}
          target="_blank"
          rel="noreferrer"
          className={classNames}
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
        className={classNames}
        style={style}
      >
        <MenuItemContent icon={icon} shortcut={shortcut} label={label} />
      </button>
    );
  }
  return (
    <div className={classNames} style={style}>
      {children}
    </div>
  );
};

export default DropdownMenuItem;
DropdownMenuItem.displayName = "DropdownMenuItem";

import "./Menu.scss";

interface MenuProps {
  icon?: JSX.Element;
  onClick?: () => void;
  children: React.ReactNode;
  dataTestId?: string;
  shortcut?: string;
  className?: string;
  link?: string;
}

const MenuContent = ({
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
  className,
  link,
}: MenuProps) => {
  if (typeof children === "string") {
    const label = children;
    if (link) {
      return (
        <a
          href={link}
          target="_blank"
          rel="noreferrer"
          className={`menu-item ${className}`}
        >
          <MenuContent icon={icon} shortcut={shortcut} label={label} />
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
      >
        <MenuContent icon={icon} shortcut={shortcut} label={label} />
      </button>
    );
  }
  return <div className={`menu-item ${className}`}>{children}</div>;
};

export default MenuItem;
MenuItem.displayName = "MenuItem";

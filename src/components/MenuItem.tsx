import "./Menu.scss";

interface MenuProps {
  icon: JSX.Element;
  onClick: () => void;
  label: string;
  dataTestId: string;
  shortcut?: string;
}

const MenuItem = ({
  icon,
  onClick,
  label,
  dataTestId,
  shortcut,
}: MenuProps) => {
  return (
    <button
      className="menu-item"
      aria-label={label}
      onClick={onClick}
      data-testid={dataTestId}
      title={label}
      type="button"
    >
      <div className="menu-item__icon">{icon}</div>
      <div className="menu-item__text">{label}</div>
      {shortcut && <div className="menu-item__shortcut">{shortcut}</div>}
    </button>
  );
};

export default MenuItem;

import clsx from "clsx";
import "./Menu.scss";

interface MenuProps {
  icon: JSX.Element;
  onClick: () => void;
  label: string;
  dataTestId: string;
  shortcut?: string;
  isCollaborating?: boolean;
}

const MenuItem = ({
  icon,
  onClick,
  label,
  dataTestId,
  shortcut,
  isCollaborating,
}: MenuProps) => {
  return (
    <button
      className={clsx("menu-item", { "active-collab": isCollaborating })}
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

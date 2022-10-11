import "./Menu.scss";

interface MenuProps {
  icon: JSX.Element;
  onClick: () => void;
  label: string;
  dataTestId: string;
}

const MenuItem = ({ icon, onClick, label, dataTestId }: MenuProps) => {
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
    </button>
  );
};

export default MenuItem;

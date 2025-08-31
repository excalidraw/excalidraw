import { useDevice } from "../App";

import { Ellipsify } from "../Ellipsify";

const MenuItemContent = ({
  icon,
  badge,
  shortcut,
  children,
}: {
  icon?: React.ReactNode;
  shortcut?: string;
  children: React.ReactNode;
  badge?: React.ReactNode;
}) => {
  const device = useDevice();
  return (
    <>
      {icon && <div className="dropdown-menu-item__icon">{icon}</div>}
      <div className="dropdown-menu-item__text">
        <Ellipsify>{children}</Ellipsify>
        {badge}
      </div>
      {shortcut && !device.editor.isMobile && (
        <div className="dropdown-menu-item__shortcut">{shortcut}</div>
      )}
    </>
  );
};
export default MenuItemContent;

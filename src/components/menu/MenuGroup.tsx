import { getValidMenuChildren } from "./menuUtils";

const MenuGroup = ({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  const menuChildren = getValidMenuChildren(children, ["MenuGroup"]);
  return <div className={`menu-group ${className}`}>{menuChildren}</div>;
};

export default MenuGroup;
MenuGroup.displayName = "MenuGroup";

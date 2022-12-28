const MenuGroup = ({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  return <div className={`menu-group ${className}`}>{children}</div>;
};

export default MenuGroup;
MenuGroup.displayName = "MenuGroup";

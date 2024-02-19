import React from "react";

const MenuGroup = ({
  children,
  className = "",
  style,
  title,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  title?: string;
}) => {
  return (
    <div className={`dropdown-menu-group ${className}`} style={style}>
      {title && <p className="dropdown-menu-group-title">{title}</p>}
      {children}
    </div>
  );
};

export default MenuGroup;
MenuGroup.displayName = "DropdownMenuGroup";

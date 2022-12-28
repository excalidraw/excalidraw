import React from "react";

const MenuGroup = ({
  children,
  className = "",
  style,
  header,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  header?: string;
}) => {
  return (
    <div className={`menu-group ${className}`} style={style}>
      {header && <p className="menu-group-header">{header}</p>}
      {children}
    </div>
  );
};

export default MenuGroup;
MenuGroup.displayName = "MenuGroup";

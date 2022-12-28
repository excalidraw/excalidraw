import React from "react";

const MenuGroup = ({
  children,
  className = "",
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) => {
  return (
    <div className={`menu-group ${className}`} style={style}>
      {children}
    </div>
  );
};

export default MenuGroup;
MenuGroup.displayName = "MenuGroup";

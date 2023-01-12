import React from "react";

const DropdownMenuItemCustom = ({
  children,
  className = "",
  ...rest
}: {
  children: React.ReactNode;
  className?: string;
} & React.HTMLAttributes<HTMLDivElement>) => {
  return (
    <div
      {...rest}
      className={`dropdown-menu-item-base dropdown-menu-item-custom ${className}`.trim()}
    >
      {children}
    </div>
  );
};

export default DropdownMenuItemCustom;

const DropdownMenuItemCustom = ({
  children,
  className = "",
  ...rest
}: {
  children: React.ReactNode;
  className?: string;
}) => {
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

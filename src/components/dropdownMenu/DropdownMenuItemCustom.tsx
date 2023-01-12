const DropdownMenuItemCustom = ({
  children,
  className = "",
  style,
  ...rest
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) => {
  return (
    <div
      {...rest}
      className={`dropdown-menu-item-base dropdown-menu-item-custom ${className}`.trim()}
      style={style}
    >
      {children}
    </div>
  );
};

export default DropdownMenuItemCustom;

const DropdownMenuItemCustom = ({
  children,
  className = "",
  style,
  "data-testid": dataTestId,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  "data-testid"?: string;
}) => {
  return (
    <div
      className={`dropdown-menu-item-base dropdown-menu-item-custom ${className}`.trim()}
      style={style}
      data-testid={dataTestId}
    >
      {children}
    </div>
  );
};

export default DropdownMenuItemCustom;

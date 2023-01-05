const DropdownMenuItemCustom = ({
  children,
  className = "",
  style,
  dataTestId,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  dataTestId?: string;
}) => {
  return (
    <div
      className={`dropdown-menu-item-base ${className}`.trim()}
      style={style}
      data-testid={dataTestId}
    >
      {children}
    </div>
  );
};

export default DropdownMenuItemCustom;

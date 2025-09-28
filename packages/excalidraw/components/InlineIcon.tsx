export const InlineIcon = ({
  className,
  icon,
  size = "1em",
}: {
  className?: string;
  icon: React.ReactNode;
  size?: string;
}) => {
  return (
    <span
      className={className}
      style={{
        width: size,
        margin: "0 0.5ex 0 0.5ex",
        display: "inline-block",
        lineHeight: 0,
        verticalAlign: "middle",
        flex: "0 0 auto",
      }}
    >
      {icon}
    </span>
  );
};

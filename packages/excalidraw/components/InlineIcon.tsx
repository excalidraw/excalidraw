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
        height: "100%",
        margin: "0 0.5ex 0 0.5ex",
        display: "inline-flex",
        lineHeight: 0,
        verticalAlign: "middle",
        flex: "0 0 auto",
      }}
    >
      {icon}
    </span>
  );
};

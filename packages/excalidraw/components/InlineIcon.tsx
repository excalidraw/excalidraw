export const InlineIcon = ({
  className,
  icon,
}: {
  className?: string;
  icon: React.ReactNode;
}) => {
  return (
    <span
      className={className}
      style={{
        width: "1em",
        margin: "0 0.5ex 0 0.5ex",
        display: "inline-block",
        lineHeight: 0,
        verticalAlign: "middle",
      }}
    >
      {icon}
    </span>
  );
};

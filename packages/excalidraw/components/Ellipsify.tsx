export const Ellipsify = ({
  children,
  ...rest
}: { children: React.ReactNode } & React.HTMLAttributes<HTMLSpanElement>) => {
  return (
    <span
      {...rest}
      style={{
        textOverflow: "ellipsis",
        overflow: "hidden",
        whiteSpace: "nowrap",
        ...rest.style,
      }}
    >
      {children}
    </span>
  );
};

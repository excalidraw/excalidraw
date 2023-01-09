interface ButtonProps extends React.HTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  className?: string;
  type?: "button" | "submit" | "reset";
}

/**
 * A generic button component that follows Excalidraw's design system.
 * Style can be customised using `className` or `style` prop.
 * Accepts all props that a regular `button` element accepts.
 */
export const Button = ({
  children,
  className,
  type = "button",
  ...rest
}: ButtonProps) => {
  return (
    <button type={type} className={`excalidraw-button ${className}`} {...rest}>
      {children}
    </button>
  );
};

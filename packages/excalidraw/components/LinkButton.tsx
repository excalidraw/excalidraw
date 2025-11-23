import { FilledButton } from "./FilledButton";

export const LinkButton = ({
  children,
  href,
}: {
  href: string;
  children: React.ReactNode;
}) => {
  return (
    <a href={href} target="_blank" rel="noopener" className="link-button">
      <FilledButton>{children}</FilledButton>
    </a>
  );
};

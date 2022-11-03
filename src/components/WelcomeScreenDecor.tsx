import { ReactNode } from "react";

const WelcomeScreenDecor = ({
  children,
  shouldRender,
}: {
  children: ReactNode;
  shouldRender: boolean;
}) => (shouldRender ? <>{children}</> : null);

export default WelcomeScreenDecor;

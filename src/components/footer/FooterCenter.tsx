import clsx from "clsx";
import { useExcalidrawAppState } from "../App";
import "./FooterCenter.scss";

const FooterCenter = ({ children }: { children?: React.ReactNode }) => {
  const appState = useExcalidrawAppState();
  return (
    <div
      className={clsx("footer-center zen-mode-transition", {
        "layer-ui__wrapper__footer-left--transition-bottom":
          appState.zenModeEnabled,
      })}
    >
      {children}
    </div>
  );
};

export default FooterCenter;
FooterCenter.displayName = "FooterCenter";

import clsx from "clsx";
import { useContext } from "react";
import { useExcalidrawAppState } from "../App";
import { TunnelsContext } from "../LayerUI";
import "./FooterCenter.scss";

const FooterCenter = ({ children }: { children?: React.ReactNode }) => {
  const { footerCenterTunnel } = useContext(TunnelsContext);
  const appState = useExcalidrawAppState();
  return (
    <footerCenterTunnel.In>
      <div
        className={clsx("footer-center zen-mode-transition", {
          "layer-ui__wrapper__footer-left--transition-bottom":
            appState.zenModeEnabled,
        })}
      >
        {children}
      </div>
    </footerCenterTunnel.In>
  );
};

export default FooterCenter;
FooterCenter.displayName = "FooterCenter";

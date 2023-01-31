import React from "react";
import tunnel from "@dwelle/tunnel-rat";

type Tunnel = ReturnType<typeof tunnel>;

type TunnelsContextValue = {
  mainMenuTunnel: Tunnel;
  welcomeScreenMenuHintTunnel: Tunnel;
  welcomeScreenToolbarHintTunnel: Tunnel;
  welcomeScreenHelpHintTunnel: Tunnel;
  welcomeScreenCenterTunnel: Tunnel;
  footerCenterTunnel: Tunnel;
  jotaiScope: symbol;
};

export const TunnelsContext = React.createContext<TunnelsContextValue>(null!);

export const useTunnels = () => React.useContext(TunnelsContext);

export const useInitializeTunnels = () => {
  return React.useMemo((): TunnelsContextValue => {
    return {
      mainMenuTunnel: tunnel(),
      welcomeScreenMenuHintTunnel: tunnel(),
      welcomeScreenToolbarHintTunnel: tunnel(),
      welcomeScreenHelpHintTunnel: tunnel(),
      welcomeScreenCenterTunnel: tunnel(),
      footerCenterTunnel: tunnel(),
      jotaiScope: Symbol(),
    };
  }, []);
};

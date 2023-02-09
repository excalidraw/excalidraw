import React from "react";
import tunnel from "@dwelle/tunnel-rat";

export type Tunnel = ReturnType<typeof tunnel>;

type TunnelsContextValue = {
  MainMenuTunnel: Tunnel;
  WelcomeScreenMenuHintTunnel: Tunnel;
  WelcomeScreenToolbarHintTunnel: Tunnel;
  WelcomeScreenHelpHintTunnel: Tunnel;
  WelcomeScreenCenterTunnel: Tunnel;
  FooterCenterTunnel: Tunnel;
  DefaultSidebarTunnel: Tunnel;
  jotaiScope: symbol;
};

export const TunnelsContext = React.createContext<TunnelsContextValue>(null!);

export const useTunnels = () => React.useContext(TunnelsContext);

export const useInitializeTunnels = () => {
  return React.useMemo((): TunnelsContextValue => {
    return {
      MainMenuTunnel: tunnel(),
      WelcomeScreenMenuHintTunnel: tunnel(),
      WelcomeScreenToolbarHintTunnel: tunnel(),
      WelcomeScreenHelpHintTunnel: tunnel(),
      WelcomeScreenCenterTunnel: tunnel(),
      FooterCenterTunnel: tunnel(),
      DefaultSidebarTunnel: tunnel(),
      jotaiScope: Symbol(),
    };
  }, []);
};

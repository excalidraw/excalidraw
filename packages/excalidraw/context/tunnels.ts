import React from "react";
import tunnel from "tunnel-rat";
import { createIsolation } from "jotai-scope";

export type Tunnel = ReturnType<typeof tunnel>;

type TunnelsContextValue = {
  MainMenuTunnel: Tunnel;
  WelcomeScreenMenuHintTunnel: Tunnel;
  WelcomeScreenToolbarHintTunnel: Tunnel;
  WelcomeScreenHelpHintTunnel: Tunnel;
  WelcomeScreenCenterTunnel: Tunnel;
  FooterCenterTunnel: Tunnel;
  DefaultSidebarTriggerTunnel: Tunnel;
  DefaultSidebarTabTriggersTunnel: Tunnel;
  OverwriteConfirmDialogTunnel: Tunnel;
  TTDDialogTriggerTunnel: Tunnel;
  jotai: ReturnType<typeof createIsolation>;
};

export const TunnelsContext = React.createContext<TunnelsContextValue>(null!);

export const useTunnels = () => React.useContext(TunnelsContext);

const isolatedJotai = createIsolation();

export const useInitializeTunnels = () => {
  return React.useMemo((): TunnelsContextValue => {
    return {
      MainMenuTunnel: tunnel(),
      WelcomeScreenMenuHintTunnel: tunnel(),
      WelcomeScreenToolbarHintTunnel: tunnel(),
      WelcomeScreenHelpHintTunnel: tunnel(),
      WelcomeScreenCenterTunnel: tunnel(),
      FooterCenterTunnel: tunnel(),
      DefaultSidebarTriggerTunnel: tunnel(),
      DefaultSidebarTabTriggersTunnel: tunnel(),
      OverwriteConfirmDialogTunnel: tunnel(),
      TTDDialogTriggerTunnel: tunnel(),
      jotai: isolatedJotai,
    };
  }, []);
};

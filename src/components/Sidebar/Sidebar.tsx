import { useLayoutEffect, useRef } from "react";
import { Island } from ".././Island";
import { atom, useAtom } from "jotai";
import { jotaiScope } from "../../jotai";
import {
  SidebarPropsContext,
  SidebarProps,
  SidebarPropsContextValue,
} from "./common";

import { SidebarHeaderComponents } from "./SidebarHeader";

import "./Sidebar.scss";

/** using a counter instead of boolean to handle race conditions where
 * the host app may render (mount/unmount) multiple different sidebar */
export const hostSidebarCountersAtom = atom({ rendered: 0, docked: 0 });

export const Sidebar = ({
  children,
  onClose,
  onDock,
  docked,
  __isInternal,
}: SidebarProps<{
  // NOTE sidebars we use internally inside the editor must have this flag set.
  // It indicates that this sidebar should have lower precedence over host
  // sidebars, if both are open.
  /** @private internal */
  __isInternal?: boolean;
}>) => {
  const [hostSidebarCounters, setHostSidebarCounters] = useAtom(
    hostSidebarCountersAtom,
    jotaiScope,
  );

  useLayoutEffect(() => {
    if (!__isInternal) {
      setHostSidebarCounters((s) => ({
        rendered: s.rendered + 1,
        docked: docked ? s.docked + 1 : s.docked,
      }));
      return () => {
        setHostSidebarCounters((s) => ({
          rendered: s.rendered - 1,
          docked: docked ? s.docked - 1 : s.docked,
        }));
      };
    }
  }, [__isInternal, setHostSidebarCounters, docked]);

  const propsRef = useRef<SidebarPropsContextValue>({});
  propsRef.current.onClose = onClose;
  propsRef.current.onDock = onDock;
  propsRef.current.docked = docked;

  if (hostSidebarCounters.rendered > 0 && __isInternal) {
    return null;
  }

  return (
    <Island padding={2} className="layer-ui__sidebar">
      <SidebarPropsContext.Provider value={propsRef.current}>
        <SidebarHeaderComponents.Context>
          <SidebarHeaderComponents.Component __isFallback />
          {children}
        </SidebarHeaderComponents.Context>
      </SidebarPropsContext.Provider>
    </Island>
  );
};

Sidebar.Header = SidebarHeaderComponents.Component;

import { useEffect, useLayoutEffect, useRef } from "react";
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
import clsx from "clsx";
import { useExcalidrawSetAppState } from "../App";

/** using a counter instead of boolean to handle race conditions where
 * the host app may render (mount/unmount) multiple different sidebar */
export const hostSidebarCountersAtom = atom({ rendered: 0, docked: 0 });

export const Sidebar = ({
  children,
  onClose,
  onDock,
  docked,
  className,
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

  const setAppState = useExcalidrawSetAppState();

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

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    return () => {
      onCloseRef.current?.();
    };
  }, []);

  const headerPropsRef = useRef<SidebarPropsContextValue>({});
  headerPropsRef.current.onClose = () => {
    setAppState({ openSidebar: null });
  };
  headerPropsRef.current.onDock = onDock;
  headerPropsRef.current.docked = docked;

  if (hostSidebarCounters.rendered > 0 && __isInternal) {
    return null;
  }

  return (
    <Island padding={2} className={clsx("layer-ui__sidebar", className)}>
      <SidebarPropsContext.Provider value={headerPropsRef.current}>
        <SidebarHeaderComponents.Context>
          <SidebarHeaderComponents.Component __isFallback />
          {children}
        </SidebarHeaderComponents.Context>
      </SidebarPropsContext.Provider>
    </Island>
  );
};

Sidebar.Header = SidebarHeaderComponents.Component;

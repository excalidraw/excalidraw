import { t } from "../i18n";
import { useDevice } from "./App";
import "./Sidebar.scss";
import { SidebarLockButton } from "./SidebarLockButton";
import { close } from "./icons";
import React, { useContext, useLayoutEffect, useRef } from "react";
import clsx from "clsx";
import { Island } from "./Island";
import { atom, useAtom } from "jotai";
import { jotaiScope } from "../jotai";
import { withUpstreamOverride } from "./hoc/withUpstreamOverride";

/** using a counter instead of boolean to handle race conditions where
 * the host app may render (mount/unmount) multiple different sidebar */
export const hostSidebarCountersAtom = atom({ rendered: 0, docked: 0 });

const _SidebarHeader: React.FC<{
  children?: React.ReactNode;
  className?: string;
}> = ({ children, className }) => {
  const device = useDevice();
  const props = useContext(SidebarPropsContext);

  return (
    <div className={clsx("layer-ui__sidebar__header", className)}>
      {children}
      <div className="layer-ui__sidebar__header__buttons">
        {device.canDeviceFitSidebar && props.onDock && (
          <>
            <div className="layer-ui__sidebar-lock-button">
              <SidebarLockButton
                checked={!!props.docked}
                onChange={() => {
                  if (props.onDock) {
                    document
                      .querySelector(".layer-ui__wrapper")
                      ?.classList.add("animate");

                    props.onDock(!props.docked);
                  }
                }}
              />
            </div>
          </>
        )}
        {props.onClose && (
          <div className="ToolIcon__icon__close">
            <button
              className="Modal__close"
              onClick={props.onClose}
              aria-label={t("buttons.close")}
            >
              {close}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const [SidebarHeaderContext, SidebarHeader] =
  withUpstreamOverride(_SidebarHeader);

type SidebarProps<P = {}> = {
  children: React.ReactNode;
  /** if not supplied, sidebar won't be closable */
  onClose?: () => void;
  /** if not supplied, sidebar won't be dockable */
  onDock?: (docked: boolean) => void;
  docked?: boolean;
} & P;

type SidebarPropsContextValue = Pick<
  SidebarProps,
  "onClose" | "onDock" | "docked"
>;
const SidebarPropsContext = React.createContext<SidebarPropsContextValue>({});

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
        <SidebarHeaderContext>
          <SidebarHeader __isFallback />
          {children}
        </SidebarHeaderContext>
      </SidebarPropsContext.Provider>
    </Island>
  );
};

Sidebar.Header = SidebarHeader;

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  forwardRef,
} from "react";
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
import { updateObject } from "../../utils";

/** using a counter instead of boolean to handle race conditions where
 * the host app may render (mount/unmount) multiple different sidebar */
export const hostSidebarCountersAtom = atom({ rendered: 0, docked: 0 });

export const Sidebar = Object.assign(
  forwardRef(
    (
      {
        children,
        onClose,
        onDock,
        docked,
        /** Undocumented, may be removed later. Generally should either be
         * `props.docked` or `appState.isSidebarDocked`. Currently serves to
         *  prevent unwanted animation of the shadow if initially docked. */
        //
        // NOTE we'll want to remove this after we sort out how to subscribe to
        // individual appState properties
        initialDockedState = docked,
        dockable = true,
        className,
        __isInternal,
      }: SidebarProps<{
        // NOTE sidebars we use internally inside the editor must have this flag set.
        // It indicates that this sidebar should have lower precedence over host
        // sidebars, if both are open.
        /** @private internal */
        __isInternal?: boolean;
      }>,
      ref: React.ForwardedRef<HTMLDivElement>,
    ) => {
      const [hostSidebarCounters, setHostSidebarCounters] = useAtom(
        hostSidebarCountersAtom,
        jotaiScope,
      );

      const setAppState = useExcalidrawSetAppState();

      const [isDockedFallback, setIsDockedFallback] = useState(
        docked ?? initialDockedState ?? false,
      );

      useLayoutEffect(() => {
        if (docked === undefined) {
          // ugly hack to get initial state out of AppState without subscribing
          // to it as a whole (once we have granular subscriptions, we'll move
          // to that)
          //
          // NOTE this means that is updated `state.isSidebarDocked` changes outside
          // of this compoent, it won't be reflected here. Currently doesn't happen.
          setAppState((state) => {
            setIsDockedFallback(state.isSidebarDocked);
            // bail from update
            return null;
          });
        }
      }, [setAppState, docked]);

      useLayoutEffect(() => {
        if (!__isInternal) {
          setHostSidebarCounters((s) => ({
            rendered: s.rendered + 1,
            docked: isDockedFallback ? s.docked + 1 : s.docked,
          }));
          return () => {
            setHostSidebarCounters((s) => ({
              rendered: s.rendered - 1,
              docked: isDockedFallback ? s.docked - 1 : s.docked,
            }));
          };
        }
      }, [__isInternal, setHostSidebarCounters, isDockedFallback]);

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
      headerPropsRef.current.onDock = (isDocked) => {
        if (docked === undefined) {
          setAppState({ isSidebarDocked: isDocked });
          setIsDockedFallback(isDocked);
        }
        onDock?.(isDocked);
      };
      // renew the ref object if the following props change since we want to
      // rerender. We can't pass down as component props manually because
      // the <Sidebar.Header/> can be rendered upsream.
      headerPropsRef.current = updateObject(headerPropsRef.current, {
        docked: docked ?? isDockedFallback,
        dockable,
      });

      if (hostSidebarCounters.rendered > 0 && __isInternal) {
        return null;
      }

      return (
        <Island
          className={clsx(
            "layer-ui__sidebar",
            { "layer-ui__sidebar--docked": isDockedFallback },
            className,
          )}
          ref={ref}
        >
          <SidebarPropsContext.Provider value={headerPropsRef.current}>
            <SidebarHeaderComponents.Context>
              <SidebarHeaderComponents.Component __isFallback />
              {children}
            </SidebarHeaderComponents.Context>
          </SidebarPropsContext.Provider>
        </Island>
      );
    },
  ),
  {
    Header: SidebarHeaderComponents.Component,
  },
);

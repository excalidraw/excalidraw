import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  forwardRef,
  useContext,
  useMemo,
  useImperativeHandle,
  useCallback,
  RefObject,
} from "react";
import { Island } from ".././Island";
import { atom, useSetAtom } from "jotai";
import { jotaiScope } from "../../jotai";
import {
  SidebarPropsContext,
  SidebarProps,
  SidebarPropsContextValue,
} from "./common";

import { SidebarHeader } from "./SidebarHeader";

import "./Sidebar.scss";
import clsx from "clsx";
import {
  useDevice,
  useExcalidrawAppState,
  useExcalidrawSetAppState,
} from "../App";
import { updateObject } from "../../utils";

import * as RadixTabs from "@radix-ui/react-tabs";
import React from "react";
import { KEYS } from "../../keys";
import { EVENT } from "../../constants";
import { SidebarTrigger } from "./SidebarTrigger";
import tunnel from "@dwelle/tunnel-rat";
import { useUIAppState } from "../../context/ui-appState";

const useOnClickOutside = (
  ref: RefObject<HTMLElement>,
  cb: (event: MouseEvent) => void,
) => {
  useEffect(() => {
    const listener = (event: MouseEvent) => {
      if (!ref.current) {
        return;
      }

      if (
        event.target instanceof Element &&
        (ref.current.contains(event.target) ||
          !document.body.contains(event.target))
      ) {
        return;
      }

      cb(event);
    };
    document.addEventListener("pointerdown", listener, false);

    return () => {
      document.removeEventListener("pointerdown", listener);
    };
  }, [ref, cb]);
};

/** using a counter instead of boolean to handle race conditions where
 * the host app may render (mount/unmount) multiple different sidebar */
export const hostSidebarCountersAtom = atom({ rendered: 0, docked: 0 });

export const SidebarInner = forwardRef(
  (
    {
      name,
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
      ...rest
    }: SidebarProps & Omit<React.RefAttributes<HTMLDivElement>, "onSelect">,
    ref: React.ForwardedRef<HTMLDivElement>,
  ) => {
    const setHostSidebarCounters = useSetAtom(
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

    const headerPropsRef = useRef<SidebarPropsContextValue>(
      {} as SidebarPropsContextValue,
    );
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

    const { SidebarHeaderTunnel, SidebarTabTriggersTunnel } = useMemo(
      () => ({
        SidebarHeaderTunnel: tunnel(),
        SidebarTabTriggersTunnel: tunnel(),
      }),
      [],
    );
    headerPropsRef.current.SidebarHeaderTunnel = SidebarHeaderTunnel;
    headerPropsRef.current.SidebarTabTriggersTunnel = SidebarTabTriggersTunnel;

    // if (hostSidebarCounters.rendered > 0 && __isInternal) {
    //   return null;
    // }

    const islandRef = useRef<HTMLDivElement>(null);

    useImperativeHandle(ref, () => {
      return islandRef.current!;
    });

    const device = useDevice();

    const closeLibrary = useCallback(() => {
      const isDialogOpen = !!document.querySelector(".Dialog");

      // Prevent closing if any dialog is open
      if (isDialogOpen) {
        return;
      }
      setAppState({ openSidebar: null });
    }, [setAppState]);

    useOnClickOutside(
      islandRef,
      useCallback(
        (event) => {
          // If click on the library icon, do nothing so that LibraryButton
          // can toggle library menu
          if ((event.target as Element).closest(".ToolIcon__library")) {
            return;
          }
          if (!isDockedFallback || !device.canDeviceFitSidebar) {
            closeLibrary();
          }
        },
        [closeLibrary, isDockedFallback, device.canDeviceFitSidebar],
      ),
    );

    useEffect(() => {
      const handleKeyDown = (event: KeyboardEvent) => {
        if (
          event.key === KEYS.ESCAPE &&
          (!isDockedFallback || !device.canDeviceFitSidebar)
        ) {
          closeLibrary();
        }
      };
      document.addEventListener(EVENT.KEYDOWN, handleKeyDown);
      return () => {
        document.removeEventListener(EVENT.KEYDOWN, handleKeyDown);
      };
    }, [closeLibrary, isDockedFallback, device.canDeviceFitSidebar]);

    return (
      <Island
        {...rest}
        className={clsx(
          "layer-ui__sidebar",
          { "layer-ui__sidebar--docked": isDockedFallback },
          className,
        )}
        ref={islandRef}
      >
        <SidebarPropsContext.Provider value={headerPropsRef.current}>
          <SidebarHeaderTunnel.Out />
          {/* render children first so that the SidebarHeader override
              is rendered first (to remove flicker). It's then tunneled
              above. 🐒 */}
          {children}
          {/* default sidebar header if none provided (close + dock) */}
          <SidebarHeader __fallback />
        </SidebarPropsContext.Provider>
      </Island>
    );
  },
);

const SidebarTabs = ({
  children,
  ...rest
}: {
  children: React.ReactNode;
} & Omit<React.RefAttributes<HTMLDivElement>, "onSelect">) => {
  const { SidebarTabTriggersTunnel } = useContext(SidebarPropsContext);

  const appState = useUIAppState();
  const setAppState = useExcalidrawSetAppState();

  if (!appState.openSidebar) {
    return null;
  }
  const { name, tab } = appState.openSidebar;

  if (!tab) {
    return null;
  }

  return (
    <RadixTabs.Root
      value={appState.openSidebar.tab}
      onValueChange={(value) =>
        setAppState((state) => ({
          ...state,
          openSidebar: { ...state.openSidebar, name, tab: value },
        }))
      }
      style={{ flex: "1 1 auto", display: "flex", flexDirection: "column" }}
      {...rest}
    >
      {children}
      {/* For now we want to always render trigger list at the bottom. We may
          support putting it anywhere later, but it would require some changes
          in DefaultSidebar. */}
      <SidebarTabTriggersTunnel.Out />
    </RadixTabs.Root>
  );
};

const TabTriggers = ({
  children,
  ...rest
}: { children: React.ReactNode } & Omit<
  React.RefAttributes<HTMLDivElement>,
  "onSelect"
>) => {
  const { SidebarTabTriggersTunnel } = useContext(SidebarPropsContext);
  return (
    <SidebarTabTriggersTunnel.In>
      <RadixTabs.List className="sidebar-triggers" {...rest}>
        {children}
      </RadixTabs.List>
    </SidebarTabTriggersTunnel.In>
  );
};

const SidebarTabTrigger = ({
  children,
  value,
  onSelect,
  ...rest
}: {
  children: React.ReactNode;
  value: string;
  onSelect?: React.ReactEventHandler<HTMLButtonElement> | undefined;
} & Omit<React.RefAttributes<HTMLButtonElement>, "onSelect">) => {
  return (
    <RadixTabs.Trigger value={value} asChild onSelect={onSelect}>
      <button
        type={"button"}
        className={`excalidraw-button sidebar-tab-trigger`}
        {...rest}
      >
        {children}
      </button>
    </RadixTabs.Trigger>
  );
};

export const Sidebar = Object.assign(
  forwardRef((props: SidebarProps, ref: React.ForwardedRef<HTMLDivElement>) => {
    const appState = useExcalidrawAppState();

    const [mounted, setMounted] = useState(false);
    useLayoutEffect(() => {
      setMounted(true);
      return () => setMounted(false);
    }, []);

    // We want to render in the next tick (hence `mounted` flag) so that it's
    // guaranteed to happen after unmount of the previous sidebar (in case the
    // previous sidebar is mounted after the next one). This is necessary to
    // prevent flicker of subcomponents that support fallbacks
    // (e.g. SidebarHeader). This is because we're using flags to determine
    // whether prefer the fallback component or not (otherwise both will render
    // initially), and the flag won't be reset in time if the unmount order
    // it not correct.
    //
    // Alternative, and more general solution would be to namespace the fallback
    // HoC so that state is not shared between subcomponents when the wrapping
    // component is of the same type (e.g. Sidebar -> SidebarHeader).
    const shouldRender = mounted && appState.openSidebar?.name === props.name;

    if (!shouldRender) {
      return null;
    }

    return <SidebarInner {...props} ref={ref} key={props.name} />;
  }),
  {
    Header: SidebarHeader,
    TabTriggers,
    TabTrigger: SidebarTabTrigger,
    Tabs: SidebarTabs,
    Tab: RadixTabs.Content,
    Trigger: SidebarTrigger,
  },
);

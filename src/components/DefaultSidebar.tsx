import clsx from "clsx";
import { DEFAULT_SIDEBAR, LIBRARY_SIDEBAR_TAB } from "../constants";
import { useTunnels } from "../context/tunnels";
import { useUIAppState } from "../context/ui-appState";
import { t } from "../i18n";
import { MarkOptional } from "../utility-types";
import { composeEventHandlers } from "../utils";
import { useExcalidrawSetAppState } from "./App";
import { withInternalFallback } from "./hoc/withInternalFallback";
import { LibraryMenu } from "./LibraryMenu";
import { SidebarProps, SidebarTriggerProps } from "./Sidebar/common";
import { Sidebar } from "./Sidebar/Sidebar";

const DefaultSidebarTrigger = withInternalFallback(
  "DefaultSidebarTrigger",
  (props: SidebarTriggerProps) => {
    const { DefaultSidebarTriggerTunnel } = useTunnels();
    return (
      <DefaultSidebarTriggerTunnel.In>
        <Sidebar.Trigger {...props} />
      </DefaultSidebarTriggerTunnel.In>
    );
  },
);

const DefaultTabTriggers = ({ children }: { children: React.ReactNode }) => {
  const { DefaultSidebarTabTriggersTunnel } = useTunnels();
  return (
    <DefaultSidebarTabTriggersTunnel.In>
      <Sidebar.TabTriggers>{children}</Sidebar.TabTriggers>
    </DefaultSidebarTabTriggersTunnel.In>
  );
};

export const DefaultSidebar = Object.assign(
  withInternalFallback(
    "DefaultSidebar",
    ({
      children,
      className,
      onDock,
      docked,
      dockable,
      ...rest
    }: MarkOptional<Omit<SidebarProps, "name">, "children">) => {
      const appState = useUIAppState();
      const setAppState = useExcalidrawSetAppState();

      const { DefaultSidebarTabTriggersTunnel } = useTunnels();

      return (
        <Sidebar
          {...rest}
          name="default"
          key="default"
          className={clsx("layer-ui__default-sidebar", className)}
          docked={docked ?? appState.defaultSidebarDockedPreference}
          dockable={docked == null ? dockable : false}
          onDock={composeEventHandlers(onDock, (docked) => {
            setAppState({ defaultSidebarDockedPreference: docked });
          })}
        >
          <Sidebar.Tabs defaultTab={DEFAULT_SIDEBAR.defaultTab}>
            <Sidebar.Header>
              {rest.__fallback && (
                <div
                  style={{
                    color: "var(--color-primary)",
                    fontSize: "1.2em",
                    fontWeight: "bold",
                    textOverflow: "ellipsis",
                    overflow: "hidden",
                    whiteSpace: "nowrap",
                    paddingRight: "1em",
                  }}
                >
                  {t("toolBar.library")}
                </div>
              )}
              <DefaultSidebarTabTriggersTunnel.Out />
            </Sidebar.Header>
            <Sidebar.Tab value={LIBRARY_SIDEBAR_TAB}>
              <LibraryMenu />
            </Sidebar.Tab>
            {children}
          </Sidebar.Tabs>
        </Sidebar>
      );
    },
  ),
  {
    Trigger: DefaultSidebarTrigger,
    TabTriggers: DefaultTabTriggers,
  },
);

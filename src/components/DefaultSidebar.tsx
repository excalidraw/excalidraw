import clsx from "clsx";
import { LIBRARY_SIDEBAR } from "../constants";
import { useTunnels } from "../context/tunnels";
import { useUIAppState } from "../context/ui-appState";
import { withInternalFallback } from "./hoc/withInternalFallback";
import { LibrarySidebarTabContent } from "./LibraryMenu";
import { SidebarProps, SidebarTriggerProps } from "./Sidebar/common";
import { Sidebar } from "./Sidebar/Sidebar";

const DefaultSidebarTrigger = withInternalFallback(
  "DefaultSidebarTrigger",
  (props: SidebarTriggerProps) => {
    const { DefaultSidebarTunnel } = useTunnels();
    return (
      <DefaultSidebarTunnel.In>
        <Sidebar.Trigger {...props} />
      </DefaultSidebarTunnel.In>
    );
  },
);

export const DefaultSidebar = Object.assign(
  withInternalFallback(
    "DefaultSidebar",
    ({
      children,
      className,
      onDock,
      ...rest
    }: MarkOptional<
      Omit<SidebarProps, "name" | "initialDockedState">,
      "children"
    >) => {
      const appState = useUIAppState();

      return (
        <Sidebar
          {...rest}
          name="default"
          key="default"
          className={clsx("layer-ui__library-sidebar", className)}
          initialDockedState={appState.isSidebarDocked}
        >
          <Sidebar.Tabs>
            <Sidebar.Tab
              value={LIBRARY_SIDEBAR.tab}
              style={{
                flex: "1 1 auto",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <LibrarySidebarTabContent />
            </Sidebar.Tab>
            {children}
          </Sidebar.Tabs>
        </Sidebar>
      );
    },
  ),
  {
    Trigger: DefaultSidebarTrigger,
  },
);

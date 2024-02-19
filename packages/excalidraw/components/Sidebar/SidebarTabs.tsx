import * as RadixTabs from "@radix-ui/react-tabs";
import { useUIAppState } from "../../context/ui-appState";
import { useExcalidrawSetAppState } from "../App";

export const SidebarTabs = ({
  children,
  ...rest
}: {
  children: React.ReactNode;
} & Omit<React.RefAttributes<HTMLDivElement>, "onSelect">) => {
  const appState = useUIAppState();
  const setAppState = useExcalidrawSetAppState();

  if (!appState.openSidebar) {
    return null;
  }

  const { name } = appState.openSidebar;

  return (
    <RadixTabs.Root
      className="sidebar-tabs-root"
      value={appState.openSidebar.tab}
      onValueChange={(tab) =>
        setAppState((state) => ({
          ...state,
          openSidebar: { ...state.openSidebar, name, tab },
        }))
      }
      {...rest}
    >
      {children}
    </RadixTabs.Root>
  );
};
SidebarTabs.displayName = "SidebarTabs";

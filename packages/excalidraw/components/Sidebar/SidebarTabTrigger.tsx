import * as RadixTabs from "@radix-ui/react-tabs";

import type { SidebarTabName } from "../../types";

export const SidebarTabTrigger = ({
  children,
  tab,
  onSelect,
  ...rest
}: {
  children: React.ReactNode;
  tab: SidebarTabName;
  onSelect?: React.ReactEventHandler<HTMLButtonElement> | undefined;
} & Omit<React.HTMLAttributes<HTMLButtonElement>, "onSelect">) => {
  return (
    <RadixTabs.Trigger value={tab} asChild onSelect={onSelect}>
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
SidebarTabTrigger.displayName = "SidebarTabTrigger";

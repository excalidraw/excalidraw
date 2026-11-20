import { Tabs as RadixTabs } from "radix-ui";

import { Tooltip } from "../Tooltip";

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
  const trigger = (
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

  const label = rest["aria-label"] || rest.title;
  return label ? <Tooltip label={label}>{trigger}</Tooltip> : trigger;
};
SidebarTabTrigger.displayName = "SidebarTabTrigger";

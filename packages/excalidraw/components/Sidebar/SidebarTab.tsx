import * as RadixTabs from "@radix-ui/react-tabs";
import { SidebarTabName } from "../../types";

export const SidebarTab = ({
  tab,
  children,
  ...rest
}: {
  tab: SidebarTabName;
  children: React.ReactNode;
} & React.HTMLAttributes<HTMLDivElement>) => {
  return (
    <RadixTabs.Content {...rest} value={tab} data-testid={tab}>
      {children}
    </RadixTabs.Content>
  );
};
SidebarTab.displayName = "SidebarTab";

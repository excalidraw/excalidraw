import * as RadixTabs from "@radix-ui/react-tabs";

export const SidebarTabTriggers = ({
  children,
  ...rest
}: { children: React.ReactNode } & Omit<
  React.RefAttributes<HTMLDivElement>,
  "onSelect"
>) => {
  return (
    <RadixTabs.List className="sidebar-triggers" {...rest}>
      {children}
    </RadixTabs.List>
  );
};
SidebarTabTriggers.displayName = "SidebarTabTriggers";

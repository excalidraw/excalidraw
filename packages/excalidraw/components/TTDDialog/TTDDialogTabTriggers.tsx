import { Tabs as RadixTabs } from "radix-ui";

export const TTDDialogTabTriggers = ({
  children,
  ...rest
}: { children: React.ReactNode } & React.HTMLAttributes<HTMLDivElement>) => {
  return (
    <RadixTabs.List className="ttd-dialog-triggers" {...rest}>
      {children}
    </RadixTabs.List>
  );
};
TTDDialogTabTriggers.displayName = "TTDDialogTabTriggers";

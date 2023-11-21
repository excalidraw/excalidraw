import * as RadixTabs from "@radix-ui/react-tabs";

export const TTDDialogTab = ({
  tab,
  children,
  ...rest
}: {
  tab: string;
  children: React.ReactNode;
} & React.HTMLAttributes<HTMLDivElement>) => {
  return (
    <RadixTabs.Content {...rest} value={tab} className="ttd-dialog-content">
      {children}
    </RadixTabs.Content>
  );
};
TTDDialogTab.displayName = "TTDDialogTab";

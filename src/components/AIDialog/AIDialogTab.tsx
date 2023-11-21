import * as RadixTabs from "@radix-ui/react-tabs";

export const AIDialogTab = ({
  tab,
  children,
  ...rest
}: {
  tab: string;
  children: React.ReactNode;
} & React.HTMLAttributes<HTMLDivElement>) => {
  return (
    <RadixTabs.Content {...rest} value={tab}>
      {children}
    </RadixTabs.Content>
  );
};
AIDialogTab.displayName = "AIDialogTab";

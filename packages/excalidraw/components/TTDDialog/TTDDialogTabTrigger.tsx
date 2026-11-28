import { Tabs as RadixTabs } from "radix-ui";

export const TTDDialogTabTrigger = ({
  children,
  tab,
  onSelect,
  ...rest
}: {
  children: React.ReactNode;
  tab: string;
  onSelect?: React.ReactEventHandler<HTMLButtonElement> | undefined;
} & Omit<React.HTMLAttributes<HTMLButtonElement>, "onSelect">) => {
  return (
    <RadixTabs.Trigger value={tab} asChild onSelect={onSelect}>
      <button
        data-excalidraw-control=""
        type="button"
        className="ttd-dialog-tab-trigger"
        {...rest}
      >
        {children}
      </button>
    </RadixTabs.Trigger>
  );
};
TTDDialogTabTrigger.displayName = "TTDDialogTabTrigger";

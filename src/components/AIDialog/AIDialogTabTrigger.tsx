import * as RadixTabs from "@radix-ui/react-tabs";

export const AIDialogTabTrigger = ({
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
        type={"button"}
        className={`excalidraw-button ai-dialog-tab-trigger`}
        {...rest}
      >
        {children}
      </button>
    </RadixTabs.Trigger>
  );
};
AIDialogTabTrigger.displayName = "AIDialogTabTrigger";

import * as RadixTabs from "@radix-ui/react-tabs";
import { ReactNode } from "react";
import { useExcalidrawSetAppState } from "../App";

const TTDDialogTabs = ({
  children,
  tab,
  ...rest
}: {
  children: ReactNode;
  tab: string;
}) => {
  const setAppState = useExcalidrawSetAppState();

  return (
    <RadixTabs.Root
      className="ttd-dialog-tabs-root"
      value={tab}
      onValueChange={(
        // at least in test enviros, `tab` can be `undefined`
        tab: string | undefined,
      ) => {
        if (tab) {
          setAppState({
            openDialog: { name: "ttd", tab },
          });
        }
      }}
      {...rest}
    >
      {children}
    </RadixTabs.Root>
  );
};

TTDDialogTabs.displayName = "TTDDialogTabs";

export default TTDDialogTabs;

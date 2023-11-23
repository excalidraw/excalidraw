import { ReactNode } from "react";
import { useTunnels } from "../../context/tunnels";
import DropdownMenu from "../dropdownMenu/DropdownMenu";
import { useExcalidrawSetAppState } from "../App";

export const TTDDialogTrigger = ({
  children,
  icon,
}: {
  children: ReactNode;
  icon?: JSX.Element;
}) => {
  const { TTDDialogTriggerTunnel } = useTunnels();
  const setAppState = useExcalidrawSetAppState();

  return (
    <TTDDialogTriggerTunnel.In>
      <DropdownMenu.Item
        onSelect={() => {
          setAppState({ openDialog: { name: "ttd", tab: "text-to-diagram" } });
        }}
        icon={icon}
      >
        {children}
      </DropdownMenu.Item>
    </TTDDialogTriggerTunnel.In>
  );
};
TTDDialogTrigger.displayName = "TTDDialogTrigger";

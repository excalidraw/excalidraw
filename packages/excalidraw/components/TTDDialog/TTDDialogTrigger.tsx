import type { ReactNode } from "react";
import { useTunnels } from "../../context/tunnels";
import DropdownMenu from "../dropdownMenu/DropdownMenu";
import { useExcalidrawSetAppState } from "../App";
import { brainIcon } from "../icons";
import { t } from "../../i18n";
import { trackEvent } from "../../analytics";

export const TTDDialogTrigger = ({
  children,
  icon,
}: {
  children?: ReactNode;
  icon?: JSX.Element;
}) => {
  const { TTDDialogTriggerTunnel } = useTunnels();
  const setAppState = useExcalidrawSetAppState();

  return (
    <TTDDialogTriggerTunnel.In>
      <DropdownMenu.Item
        onSelect={() => {
          trackEvent("ai", "dialog open", "ttd");
          setAppState({ openDialog: { name: "ttd", tab: "text-to-diagram" } });
        }}
        icon={icon ?? brainIcon}
      >
        {children ?? t("labels.textToDiagram")}
        <DropdownMenu.Item.Badge>AI</DropdownMenu.Item.Badge>
      </DropdownMenu.Item>
    </TTDDialogTriggerTunnel.In>
  );
};
TTDDialogTrigger.displayName = "TTDDialogTrigger";

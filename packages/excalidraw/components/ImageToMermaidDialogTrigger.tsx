import { trackEvent } from "../analytics";
import { useTunnels } from "../context/tunnels";
import DropdownMenu from "./dropdownMenu/DropdownMenu";
import { ImageIcon } from "./icons";
import { imageToMermaidDialogOpenAtom } from "../editor-jotai";
import type { Store } from "jotai";

import type { JSX, ReactNode } from "react";

export const ImageToMermaidDialogTrigger = ({
  children,
  icon,
  jotaiStore,
}: {
  children?: ReactNode;
  icon?: JSX.Element;
  jotaiStore?: Store;
}) => {
  const { ImageToMermaidDialogTriggerTunnel } = useTunnels();

  return (
    <ImageToMermaidDialogTriggerTunnel.In>
      <DropdownMenu.Item
        onSelect={() => {
          trackEvent("ai", "dialog open", "image-to-diagram");
          if (jotaiStore) {
            jotaiStore.set(imageToMermaidDialogOpenAtom, true);
          }
        }}
        icon={icon ?? ImageIcon}
      >
        {children ?? "Image to diagram"}
        <DropdownMenu.Item.Badge>AI</DropdownMenu.Item.Badge>
      </DropdownMenu.Item>
    </ImageToMermaidDialogTriggerTunnel.In>
  );
};
ImageToMermaidDialogTrigger.displayName = "ImageToMermaidDialogTrigger";

import { trackEvent } from "../analytics";
import { useTunnels } from "../context/tunnels";

import { imageToMermaidDialogOpenAtom } from "../editor-jotai";

import DropdownMenu from "./dropdownMenu/DropdownMenu";
import { ImageIcon } from "./icons";

import type { JSX, ReactNode } from "react";

interface JotaiStore {
  set: (atom: any, value: any) => void;
  get: (atom: any) => any;
}

export const ImageToMermaidDialogTrigger = ({
  children,
  icon,
  jotaiStore,
}: {
  children?: ReactNode;
  icon?: JSX.Element;
  jotaiStore?: JotaiStore;
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

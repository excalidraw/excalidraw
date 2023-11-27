import * as RadixTabs from "@radix-ui/react-tabs";
import { ReactNode, useRef } from "react";
import { useExcalidrawSetAppState } from "../App";
import { isMemberOf } from "../../utils";

const TTDDialogTabs = (
  props: {
    children: ReactNode;
  } & (
    | { dialog: "ttd"; tab: "text-to-diagram" | "mermaid" }
    | { dialog: "settings"; tab: "text-to-diagram" | "diagram-to-code" }
  ),
) => {
  const setAppState = useExcalidrawSetAppState();

  const rootRef = useRef<HTMLDivElement>(null);
  const minHeightRef = useRef<number>(0);

  return (
    <RadixTabs.Root
      ref={rootRef}
      className="ttd-dialog-tabs-root"
      value={props.tab}
      onValueChange={(
        // at least in test enviros, `tab` can be `undefined`
        tab: string | undefined,
      ) => {
        if (!tab) {
          return;
        }
        const modalContentNode =
          rootRef.current?.closest<HTMLElement>(".Modal__content");
        if (modalContentNode) {
          const currHeight = modalContentNode.offsetHeight || 0;
          if (currHeight > minHeightRef.current) {
            minHeightRef.current = currHeight;
            modalContentNode.style.minHeight = `min(${minHeightRef.current}px, 100%)`;
          }
        }
        if (
          props.dialog === "settings" &&
          isMemberOf(["text-to-diagram", "diagram-to-code"], tab)
        ) {
          setAppState({
            openDialog: { name: props.dialog, tab, source: "settings" },
          });
        } else if (
          props.dialog === "ttd" &&
          isMemberOf(["text-to-diagram", "mermaid"], tab)
        ) {
          setAppState({
            openDialog: { name: props.dialog, tab },
          });
        }
      }}
    >
      {props.children}
    </RadixTabs.Root>
  );
};

TTDDialogTabs.displayName = "TTDDialogTabs";

export default TTDDialogTabs;

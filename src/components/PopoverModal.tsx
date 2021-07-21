import "./Modal.scss";

import React from "react";
import { createPortal } from "react-dom";

const popoverModalNodeByContainer = new WeakMap<HTMLElement, HTMLDivElement>();

const getPopoverModalNode = (container: HTMLElement): HTMLDivElement => {
  let popoverModalNode = popoverModalNodeByContainer.get(container);
  if (popoverModalNode) {
    return popoverModalNode;
  }
  popoverModalNode = document.createElement("div");
  container
    .querySelector(".excalidraw-popoverContainer")!
    .appendChild(popoverModalNode);
  popoverModalNodeByContainer.set(container, popoverModalNode);
  return popoverModalNode;
};

export const PopoverModal = ({
  container,
  children,
  zenModeEnabled = false,
}: {
  container?: HTMLElement;
  children: React.ReactNode;
  zenModeEnabled?: boolean;
}) => {
  if (container === undefined || !zenModeEnabled) {
    return <>{children}</>;
  }

  return createPortal(<>{children}</>, getPopoverModalNode(container));
};

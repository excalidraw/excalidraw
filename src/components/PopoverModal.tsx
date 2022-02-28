import React from "react";
import { createPortal } from "react-dom";

export const PopoverModal = (props: {
  container: HTMLElement | null;
  children: React.ReactNode;
}) => {
  const { container, children } = props;
  if (!container) {
    return null;
  }
  return createPortal(<>{children}</>, container);
};

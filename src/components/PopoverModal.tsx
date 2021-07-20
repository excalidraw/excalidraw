import "./Modal.scss";

import React from "react";
import { createPortal } from "react-dom";
import { useBodyRoot } from "./Modal";
import { AppState } from "../types";

export const PopoverModal = (props: {
  theme?: AppState["theme"];
  children: React.ReactNode;
}) => {
  const { theme = "light" } = props;
  const modalRoot = useBodyRoot(theme);

  if (!modalRoot) {
    return null;
  }
  return createPortal(<>{props.children}</>, modalRoot);
};

import React, { useEffect, useRef } from "react";
import { Modal } from "./Modal";
import { Island } from "./Island";
import { t } from "../i18n";
import useIsMobile from "../is-mobile";
import { back, close } from "./icons";

import "./Dialog.scss";

export function Dialog(props: {
  children: React.ReactNode;
  className?: string;
  maxWidth?: number;
  onCloseRequest(): void;
  closeButtonRef?: React.Ref<HTMLButtonElement>;
  title: React.ReactNode;
}) {
  const islandRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!islandRef.current) {
      return;
    }

    const buttons = islandRef.current.querySelectorAll("button");

    if (buttons.length > 0) {
      // If there's a button other than close, focus it.
      (buttons[1] || buttons[0]).focus();
    }
  }, []);

  return (
    <Modal
      className={`${props.className ?? ""} Dialog`}
      labelledBy="dialog-title"
      maxWidth={props.maxWidth}
      onCloseRequest={props.onCloseRequest}
    >
      <Island padding={4} ref={islandRef}>
        <h2 id="dialog-title" className="Dialog__title">
          <span className="Dialog__titleContent">{props.title}</span>
          <button
            className="Modal__close"
            onClick={props.onCloseRequest}
            aria-label={t("buttons.close")}
            ref={props.closeButtonRef}
          >
            {useIsMobile() ? back : close}
          </button>
        </h2>
        {props.children}
      </Island>
    </Modal>
  );
}

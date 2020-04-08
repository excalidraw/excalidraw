import React, { useEffect, useRef } from "react";
import { Modal } from "./Modal";
import { Island } from "./Island";
import { t } from "../i18n";
import useIsMobile from "../is-mobile";
import { back, close } from "./icons";
import { KEYS } from "../keys";

import "./Dialog.scss";

export function Dialog(props: {
  children: React.ReactNode;
  className?: string;
  maxWidth?: number;
  onCloseRequest(): void;
  title: React.ReactNode;
}) {
  const islandRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const focusableElements = queryFocusableElements();

    if (focusableElements.length > 0) {
      // If there's an element other than close, focus it.
      (focusableElements[1] || focusableElements[0]).focus();
    }
  }, []);

  useEffect(() => {
    if (!islandRef.current) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === KEYS.TAB) {
        const focusableElements = queryFocusableElements();
        const { activeElement } = document;
        const currentIndex = focusableElements.findIndex(
          (element) => element === activeElement,
        );

        if (currentIndex === 0 && event.shiftKey) {
          focusableElements[focusableElements.length - 1].focus();
          event.preventDefault();
        } else if (
          currentIndex === focusableElements.length - 1 &&
          !event.shiftKey
        ) {
          focusableElements[0].focus();
          event.preventDefault();
        }
      }
    }

    const node = islandRef.current;
    node.addEventListener("keydown", handleKeyDown);

    return () => node.removeEventListener("keydown", handleKeyDown);
  }, []);

  function queryFocusableElements() {
    const focusableElements = islandRef.current?.querySelectorAll<HTMLElement>(
      "button, a, input, select, textarea, div[tabindex]",
    );

    return focusableElements ? Array.from(focusableElements) : [];
  }

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
          >
            {useIsMobile() ? back : close}
          </button>
        </h2>
        {props.children}
      </Island>
    </Modal>
  );
}

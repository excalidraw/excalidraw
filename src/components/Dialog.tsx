import clsx from "clsx";
import React, { useEffect, useState } from "react";
import { useCallbackRefState } from "../hooks/useCallbackRefState";
import { t } from "../i18n";
import { useExcalidrawContainer, useDevice } from "../components/App";
import { KEYS } from "../keys";
import "./Dialog.scss";
import { back, close } from "./icons";
import { Island } from "./Island";
import { Modal } from "./Modal";
import { AppState } from "../types";
import { queryFocusableElements } from "../utils";

export interface DialogProps {
  children: React.ReactNode;
  className?: string;
  small?: boolean;
  onCloseRequest(): void;
  title: React.ReactNode;
  autofocus?: boolean;
  theme?: AppState["theme"];
  closeOnClickOutside?: boolean;
}

export const Dialog = (props: DialogProps) => {
  const [islandNode, setIslandNode] = useCallbackRefState<HTMLDivElement>();
  const [lastActiveElement] = useState(document.activeElement);
  const { id } = useExcalidrawContainer();

  useEffect(() => {
    if (!islandNode) {
      return;
    }

    const focusableElements = queryFocusableElements(islandNode);

    if (focusableElements.length > 0 && props.autofocus !== false) {
      // If there's an element other than close, focus it.
      (focusableElements[1] || focusableElements[0]).focus();
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === KEYS.TAB) {
        const focusableElements = queryFocusableElements(islandNode);
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
    };

    islandNode.addEventListener("keydown", handleKeyDown);

    return () => islandNode.removeEventListener("keydown", handleKeyDown);
  }, [islandNode, props.autofocus]);

  const onClose = () => {
    (lastActiveElement as HTMLElement).focus();
    props.onCloseRequest();
  };

  return (
    <Modal
      className={clsx("Dialog", props.className)}
      labelledBy="dialog-title"
      maxWidth={props.small ? 550 : 800}
      onCloseRequest={onClose}
      theme={props.theme}
      closeOnClickOutside={props.closeOnClickOutside}
    >
      <Island ref={setIslandNode}>
        <h2 id={`${id}-dialog-title`} className="Dialog__title">
          <span className="Dialog__titleContent">{props.title}</span>
          <button
            className="Modal__close"
            onClick={onClose}
            title={t("buttons.close")}
            aria-label={t("buttons.close")}
          >
            {useDevice().isMobile ? back : close}
          </button>
        </h2>
        <div className="Dialog__content">{props.children}</div>
      </Island>
    </Modal>
  );
};

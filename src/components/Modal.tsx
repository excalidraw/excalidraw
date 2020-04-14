import "./Modal.scss";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { KEYS } from "../keys";

export function Modal(props: {
  className?: string;
  children: React.ReactNode;
  maxWidth?: number;
  onCloseRequest(): void;
  labelledBy: string;
}) {
  const modalRoot = useBodyRoot();

  const handleKeydown = (event: React.KeyboardEvent) => {
    if (event.key === KEYS.ESCAPE) {
      event.nativeEvent.stopImmediatePropagation();
      props.onCloseRequest();
    }
  };
  return createPortal(
    <div
      className={`Modal ${props.className ?? ""}`}
      role="dialog"
      aria-modal="true"
      onKeyDown={handleKeydown}
      aria-labelledby={props.labelledBy}
      tabIndex={-1}
    >
      <div className="Modal__background" onClick={props.onCloseRequest}></div>
      <div
        className="Modal__content"
        style={
          {
            "--max-width": `${props.maxWidth}px`,
            maxHeight: "100%",
            overflowY: "scroll",
          } as any
        }
      >
        {props.children}
      </div>
    </div>,
    modalRoot,
  );
}

function useBodyRoot() {
  function createDiv() {
    const div = document.createElement("div");
    document.body.appendChild(div);
    return div;
  }
  const [div] = useState(createDiv);
  useEffect(() => {
    return () => {
      document.body.removeChild(div);
    };
  }, [div]);
  return div;
}

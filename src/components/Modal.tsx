import "./Modal.css";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export function Modal(props: {
  children: React.ReactNode;
  maxWidth?: number;
  onCloseRequest(): void;
}) {
  const modalRoot = useBodyRoot();
  return createPortal(
    <div className="Modal">
      <div className="Modal__background" onClick={props.onCloseRequest}></div>
      <div className="Modal__content" style={{ maxWidth: props.maxWidth }}>
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

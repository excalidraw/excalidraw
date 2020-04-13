import React from "react";
import { render } from "react-dom";
import Stack from "./Stack";
import { Island } from "./Island";
import "./Toast.css";
import { close } from "./icons";

const TOAST_TIMEOUT = 7000;

function ToastRenderer(props: {
  toasts: Map<number, React.ReactNode>;
  onCloseRequest: (id: number) => void;
}) {
  return (
    <Stack.Col gap={2} align="center">
      {[...props.toasts.entries()].map(([id, toast]) => (
        <Island key={id} padding={3}>
          <div className="Toast">
            <div className="Toast__content">{toast}</div>
            <button
              className="Toast__close"
              onClick={() => props.onCloseRequest(id)}
            >
              {close}
            </button>
          </div>
        </Island>
      ))}
    </Stack.Col>
  );
}

let toastsRootNode: HTMLDivElement;
function getToastsRootNode() {
  return toastsRootNode || (toastsRootNode = initToastsRootNode());
}

function initToastsRootNode() {
  const div = window.document.createElement("div");
  document.body.appendChild(div);
  div.className = "Toast__container";
  return div;
}

function renderToasts(
  toasts: Map<number, React.ReactNode>,
  onCloseRequest: (id: number) => void,
) {
  render(
    <ToastRenderer toasts={toasts} onCloseRequest={onCloseRequest} />,
    getToastsRootNode(),
  );
}

let incrementalId = 0;
function getToastId() {
  return incrementalId++;
}

class ToastManager {
  private toasts = new Map<number, React.ReactNode>();
  private timers = new Map<number, number>();

  public push(message: React.ReactNode, shiftAfterMs: number) {
    const id = getToastId();
    this.toasts.set(id, message);
    if (isFinite(shiftAfterMs)) {
      const handle = window.setTimeout(() => this.pop(id), shiftAfterMs);
      this.timers.set(id, handle);
    }
    this.render();
  }

  private pop = (id: number) => {
    const handle = this.timers.get(id);
    if (handle) {
      window.clearTimeout(handle);
      this.timers.delete(id);
    }
    this.toasts.delete(id);
    this.render();
  };

  private render() {
    renderToasts(this.toasts, this.pop);
  }
}

let toastManagerInstance: ToastManager;
function getToastManager(): ToastManager {
  return toastManagerInstance ?? (toastManagerInstance = new ToastManager());
}

export function push(message: React.ReactNode, manualClose = false) {
  const toastManager = getToastManager();
  toastManager.push(message, manualClose ? Infinity : TOAST_TIMEOUT);
}

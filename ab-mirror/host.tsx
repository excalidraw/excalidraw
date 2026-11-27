// The editor page loaded into each iframe. It must not import @excalidraw/*
// itself (this file is shared by both trees); left/main.tsx and
// right/main.tsx pass in their tree's module.

import { createRoot } from "react-dom/client";

type Side = "left" | "right";

export type AbHost = {
  side: Side;
  /** the tree's `@excalidraw/excalidraw` module */
  EX: any;
  api: any;
  ready: Promise<void>;
  subscribe: (cb: () => void) => () => void;
};

declare global {
  interface Window {
    ab?: AbHost;
    h?: any;
    __abFocusGate?: (win: Window) => boolean;
  }
}

/**
 * Only the pane the user last pressed in may move focus. Otherwise the
 * mirrored pane steals focus from the other iframe (Excalidraw focuses its
 * container, the text editor its textarea), and the window blur that follows
 * submits text / resets state in the pane the user is actually using.
 */
const installFocusGate = () => {
  const gate = (proto: HTMLElement | SVGElement) => {
    const focus = proto.focus;
    proto.focus = function (this: HTMLElement, options?: FocusOptions) {
      const allowed = window.parent?.__abFocusGate;
      if (allowed && !allowed(window)) {
        return;
      }
      return focus.call(this, options);
    };
  };
  gate(HTMLElement.prototype);
  gate(SVGElement.prototype);
};

export const mountHost = (EX: any, side: Side) => {
  installFocusGate();

  const listeners = new Set<() => void>();
  let resolveReady!: () => void;

  const host: AbHost = {
    side,
    EX,
    api: null,
    ready: new Promise<void>((resolve) => {
      resolveReady = resolve;
    }),
    subscribe: (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
  };
  window.ab = host;

  // identical starting state in both panes
  const initialData = {
    elements: [],
    appState: {
      currentItemArrowType: "elbow",
      // sketchy strokes use per-element random seeds that differ between
      // panes; architect strokes look identical and keep the routes readable
      currentItemRoughness: 0,
      scrollX: 0,
      scrollY: 0,
    },
  };

  const onExcalidrawAPI = (api: any) => {
    if (!api || host.api) {
      return;
    }
    host.api = api;
    api.onChange(() => listeners.forEach((cb) => cb()));
    resolveReady();
  };

  createRoot(document.getElementById("root")!).render(
    <div style={{ position: "fixed", inset: 0 }}>
      <EX.Excalidraw
        initialData={initialData}
        handleKeyboardGlobally
        onExcalidrawAPI={onExcalidrawAPI}
      />
    </div>,
  );
};

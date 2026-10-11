import { Dialog } from "@excalidraw/excalidraw/components/Dialog";
import { FilledButton } from "@excalidraw/excalidraw/components/FilledButton";

import React, { useCallback, useEffect, useRef } from "react";

import { useAtom } from "../app-jotai";
import { useAtomValue } from "../app-jotai";

import { ENDPOINTS } from "../endpoints";
import { settingsAtom, welcomeDialogStateAtom } from "../data/settingsState";

import "./WelcomeModal.scss";

/** Remembered per browser, so it greets once and then gets out of the way. */
const SEEN_KEY = "excalidraw-welcome-seen";

export const hasSeenWelcome = (): boolean => {
  try {
    return localStorage.getItem(SEEN_KEY) === "true";
  } catch {
    return false;
  }
};

export const markWelcomeSeen = (): void => {
  try {
    localStorage.setItem(SEEN_KEY, "true");
  } catch {
    // A browser that refuses storage simply sees this again. Harmless.
  }
};

const Step = ({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: React.ReactNode;
}) => (
  <li className="welcome-modal__step">
    <span className="welcome-modal__number" aria-hidden="true">
      {number}
    </span>
    <div>
      <h4>{title}</h4>
      {children}
    </div>
  </li>
);

/**
 * How to use it — written for a teammate opening this for the first time.
 *
 * It is honest about the sharp edge: **the app is public**, so the privacy note
 * says what is protected (rooms are end-to-end encrypted and the room key never
 * leaves the browser) and what is not (anyone with the URL can open the app).
 * A welcome that oversells privacy is worse than none.
 */
export const WelcomeModal = () => {
  const [, setOpen] = useAtom(welcomeDialogStateAtom);
  const settings = useAtomValue(settingsAtom);

  /**
   * OPEN AT THE TOP, not at the bottom.
   *
   * `Dialog` focuses the first focusable element on mount, and in this modal that
   * is the foot button — which scrolls the dialog to it, so a reader lands on the
   * last paragraph with step one already above the fold. Nothing was wrong with
   * the content; the viewport had simply been scrolled past it.
   *
   * Reset once after that focus, and once more on the next frame, because the
   * focus happens in a layout effect of its own.
   */
  const introRef = useRef<HTMLParagraphElement | null>(null);
  useEffect(() => {
    const toTop = () => {
      let node: HTMLElement | null = introRef.current;
      while (node) {
        const overflowY = window.getComputedStyle(node).overflowY;
        if (
          (overflowY === "auto" || overflowY === "scroll") &&
          node.scrollHeight > node.clientHeight
        ) {
          node.scrollTop = 0;
          return;
        }
        node = node.parentElement;
      }
    };
    toTop();
    const frame = requestAnimationFrame(toTop);
    const timer = window.setTimeout(toTop, 80);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, []);

  const close = useCallback(() => {
    markWelcomeSeen();
    setOpen({ isOpen: false });
  }, [setOpen]);

  const board = settings?.ticketsApi ?? ENDPOINTS.publicUrl;
  const modelConfigured = Boolean(settings?.aiBackend ?? ENDPOINTS.aiBackend);

  return (
    <Dialog
      title="How to use this whiteboard"
      size="regular"
      onCloseRequest={close}
      className="welcome-modal"
    >
      <p className="welcome-modal__intro" ref={introRef} tabIndex={-1}>
        It is Excalidraw, self-hosted by zerwiz — so everything you already know
        about drawing works, and nothing you draw goes to anybody else's
        service.
      </p>

      <ol className="welcome-modal__steps">
        <Step number="1" title="Draw">
          <p>
            Pick a tool and go. <kbd>R</kbd> rectangle, <kbd>D</kbd> diamond,{" "}
            <kbd>A</kbd> arrow,
            <kbd>T</kbd> text. Your work saves in this browser as you go;{" "}
            <em>Open</em> and <em>Save to…</em> move files in and out.
          </p>
        </Step>

        <Step number="2" title="Work together in a room">
          <p>
            <strong>Live collaboration</strong> → <strong>Start session</strong>
            , then send the link it gives you. The room is{" "}
            <strong>end-to-end encrypted</strong>: the key lives in the part of
            the link after the <code>#</code>, which a browser never sends to a
            server, so our room server relays your drawing without being able to
            read it.
          </p>
          <p className="welcome-modal__note">
            Whoever holds the link can join — treat the link as the key.
          </p>
        </Step>

        <Step number="3" title="Use AI, with a model you choose">
          {modelConfigured ? (
            <p>
              A model is connected.{" "}
              <strong>More tools → Text to diagram</strong> turns a sentence
              into a diagram; <strong>Mermaid</strong> in the same dialog takes
              Mermaid source directly. Which model answers — and where it runs —
              is yours to set in <strong>Settings</strong>.
            </p>
          ) : (
            <p>
              <strong>More tools → Text to diagram</strong> appears once a model
              is connected. Open <strong>Settings → Models</strong>, add your
              endpoint — a local llama.cpp, Claude, or OpenCode Zen — press{" "}
              <em>List models</em>, pick one, and <em>Test connection</em>.
              Settings saves as you type; there is no Save button.
            </p>
          )}
        </Step>

        <Step number="4" title="See what we are working on">
          <p>
            The <strong>tickets board</strong> reads the work items straight
            from the repository — each one a contract, not a to-do. Move a card
            between columns and the file moves with it.
            {board ? (
              <>
                {" "}
                It is at <code>{board.replace(/^https?:\/\//, "")}</code>.
              </>
            ) : null}
          </p>
        </Step>

        <Step number="5" title="Open it as a desktop app">
          <p>
            The launcher entry <strong>Excalidraw</strong> opens it in its own
            window, from local files — no browser tab. Right-click the entry for{" "}
            <em>Stop</em>.
          </p>
        </Step>
      </ol>

      <div className="welcome-modal__privacy">
        <h4>What we are careful about</h4>
        <ul>
          <li>
            <strong>Rooms are private to their members.</strong> The server
            stores and forwards ciphertext; it cannot read a board.
          </li>
          <li>
            <strong>No telemetry, no third-party services.</strong> The app
            makes no request to anybody we do not run.
          </li>
          <li>
            <strong>But this deployment is open.</strong> Anyone with the
            address can open the app and start a room. Until an access gate is
            put in front of it, keep client, personal, and confidential material
            off the canvas.
          </li>
        </ul>
      </div>

      <div className="welcome-modal__actions">
        <FilledButton onClick={close}>Got it</FilledButton>
        <span className="welcome-modal__hint">
          You can reopen this from the menu: <strong>How to use</strong>.
        </span>
      </div>
    </Dialog>
  );
};

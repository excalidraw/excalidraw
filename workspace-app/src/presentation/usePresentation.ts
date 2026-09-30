import { useCallback, useEffect, useRef, useState } from "react";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { getSlideElements } from "./slides";

import type { Presenter } from "../editor/useCollab";

interface Options {
  apiRef: React.MutableRefObject<ExcalidrawImperativeAPI | null>;
  hostRef: React.RefObject<HTMLElement | null>;
  /** editors drive the presentation; others may only follow */
  canPresent: boolean;
  presenter: Presenter | null;
  ownConnId: string | null;
  sendPresent: (frameId: string, index: number) => void;
  stopPresent: () => void;
}

const PRESENT_FRAME_RENDERING = {
  enabled: true,
  name: false,
  outline: false,
  clip: true,
} as const;

/**
 * Presentation over native frames:
 *   - presenter: navigates slides, broadcasting the current one (editors only)
 *   - follower:  read-only, locked to whatever the presenter shows
 */
export const usePresentation = ({
  apiRef,
  hostRef,
  canPresent,
  presenter,
  ownConnId,
  sendPresent,
  stopPresent,
}: Options) => {
  const [active, setActive] = useState(false);
  const [following, setFollowing] = useState(false);
  const [index, setIndex] = useState(0);
  const [count, setCount] = useState(0);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const savedFrameRendering = useRef<any>(null);
  const activeRef = useRef(false);
  const followingRef = useRef(false);

  const slidesNow = useCallback(
    () => getSlideElements(apiRef.current?.getSceneElements() ?? []),
    [apiRef],
  );

  const show = useCallback(
    (i: number, broadcast: boolean) => {
      const api = apiRef.current;
      const slides = slidesNow();
      if (!api || slides.length === 0) {
        return;
      }
      const at = Math.max(0, Math.min(slides.length - 1, i));
      const frame = slides[at];
      setIndex(at);
      setCount(slides.length);
      setTitle(frame.name || `Slide ${at + 1}`);
      void api.setViewport({
        target: frame,
        fit: "contain",
        animation: { duration: 350 },
      } as any);
      if (broadcast && canPresent) {
        sendPresent(frame.id, at);
      }
    },
    [apiRef, canPresent, sendPresent, slidesNow],
  );

  const enter = useCallback(
    (asFollower: boolean) => {
      const api = apiRef.current;
      if (!api || activeRef.current) {
        return false;
      }
      if (slidesNow().length === 0) {
        setMessage("Add at least one frame (use the Slides panel) to present.");
        return false;
      }
      setMessage(null);
      savedFrameRendering.current = api.getAppState().frameRendering;
      api.updateScene({
        appState: { frameRendering: PRESENT_FRAME_RENDERING } as any,
      });
      activeRef.current = true;
      followingRef.current = asFollower;
      setActive(true);
      setFollowing(asFollower);
      void hostRef.current?.requestFullscreen?.().catch(() => {});
      return true;
    },
    [apiRef, hostRef, slidesNow],
  );

  const start = useCallback(
    (from = 0) => {
      if (enter(false)) {
        show(from, true);
      }
    },
    [enter, show],
  );

  const follow = useCallback(() => {
    if (presenter && enter(true)) {
      const i = slidesNow().findIndex((f) => f.id === presenter.frameId);
      show(i >= 0 ? i : presenter.index, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enter, presenter, show]);

  const exit = useCallback(() => {
    if (!activeRef.current) {
      return;
    }
    const wasPresenter = !followingRef.current;
    activeRef.current = false;
    followingRef.current = false;
    setActive(false);
    setFollowing(false);
    if (wasPresenter && canPresent) {
      stopPresent();
    }
    apiRef.current?.updateScene({
      appState: {
        frameRendering: savedFrameRendering.current ?? {
          enabled: true,
          name: true,
          outline: true,
          clip: true,
        },
      } as any,
    });
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {});
    }
  }, [apiRef, canPresent, stopPresent]);

  const next = useCallback(
    () => !followingRef.current && show(index + 1, true),
    [index, show],
  );
  const prev = useCallback(
    () => !followingRef.current && show(index - 1, true),
    [index, show],
  );

  // keyboard
  useEffect(() => {
    if (!active) {
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) {
        return;
      }
      const stop = () => {
        e.preventDefault();
        e.stopPropagation();
      };
      if (e.key === "Escape") {
        stop();
        exit();
      } else if (
        ["ArrowRight", "ArrowDown", "PageDown", " ", "Enter"].includes(e.key)
      ) {
        stop();
        next();
      } else if (
        ["ArrowLeft", "ArrowUp", "PageUp", "Backspace"].includes(e.key)
      ) {
        stop();
        prev();
      } else if (e.key.toLowerCase() === "f") {
        stop();
        if (document.fullscreenElement) {
          void document.exitFullscreen();
        } else {
          void hostRef.current?.requestFullscreen?.();
        }
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [active, exit, next, prev, hostRef]);

  // leaving fullscreen with the browser's own Escape ends the presentation
  useEffect(() => {
    const onFs = () => {
      if (!document.fullscreenElement && activeRef.current) {
        exit();
      }
    };
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, [exit]);

  // followers track the presenter; the presenter ending ends following
  useEffect(() => {
    if (!active || !following) {
      return;
    }
    if (!presenter) {
      setMessage("The presentation ended.");
      exit();
      return;
    }
    const i = slidesNow().findIndex((f) => f.id === presenter.frameId);
    show(i >= 0 ? i : presenter.index, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presenter, active, following]);

  const someoneElsePresenting = !!presenter && presenter.from !== ownConnId;

  return {
    active,
    following,
    index,
    count,
    title,
    message,
    setMessage,
    start,
    follow,
    exit,
    next,
    prev,
    someoneElsePresenting,
  };
};

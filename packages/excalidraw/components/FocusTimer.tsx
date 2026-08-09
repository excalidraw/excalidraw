/** Workshop focus countdown in Layer UI chrome.
 *  Local singleton — no scene mutations, no collab broadcast, no persistence. */
import clsx from "clsx";
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { useUIAppState } from "../context/ui-appState";

import { useExcalidrawSetAppState } from "./App";
import { Island } from "./Island";
import { Popover } from "./Popover";

import "./FocusTimer.scss";

const PANEL_WIDTH = 280;
const PRESETS_MINUTES = [1, 5, 10, 15] as const;

type TimerStatus = "idle" | "running" | "paused" | "expired";

type FocusTimerState = {
  status: TimerStatus;
  durationMs: number;
  /** Wall-clock end time while running — avoids tick drift. */
  endsAt: number | null;
  remainingMs: number;
};

const DEFAULT_DURATION_MS = 5 * 60 * 1000;

const initialState = (): FocusTimerState => ({
  status: "idle",
  durationMs: DEFAULT_DURATION_MS,
  endsAt: null,
  remainingMs: DEFAULT_DURATION_MS,
});

const formatMs = (ms: number): string => {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(
    2,
    "0",
  )}`;
};

/** Single-session workshop timer with presets, custom duration, and pause/resume. */
export const FocusTimer = () => {
  const [open, setOpen] = useState(false);
  const [popoverPos, setPopoverPos] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const [timer, setTimer] = useState<FocusTimerState>(initialState);
  const [customMinutes, setCustomMinutes] = useState("5");
  const [now, setNow] = useState(() => Date.now());
  const anchorRef = useRef<HTMLDivElement>(null);
  const expiredToastShownRef = useRef(false);
  const appState = useUIAppState();
  const setAppState = useExcalidrawSetAppState();

  useLayoutEffect(() => {
    if (open && anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      setPopoverPos({
        top: rect.bottom + 8,
        left: Math.max(8, rect.right - PANEL_WIDTH),
      });
    }
  }, [open]);

  // Tick while running so the display updates from wall-clock endsAt.
  useEffect(() => {
    if (timer.status !== "running" || timer.endsAt == null) {
      return;
    }
    const id = window.setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= timer.endsAt!) {
        setTimer((prev) =>
          prev.status === "running"
            ? {
                ...prev,
                status: "expired",
                endsAt: null,
                remainingMs: 0,
              }
            : prev,
        );
      }
    }, 250);
    return () => window.clearInterval(id);
  }, [timer.status, timer.endsAt]);

  // One toast when the countdown hits zero.
  useEffect(() => {
    if (timer.status === "expired" && !expiredToastShownRef.current) {
      expiredToastShownRef.current = true;
      setAppState({
        toast: {
          message: "Focus timer finished",
          duration: 4000,
          closable: true,
        },
      });
    }
    if (timer.status !== "expired") {
      expiredToastShownRef.current = false;
    }
  }, [timer.status, setAppState]);

  const displayedRemainingMs =
    timer.status === "running" && timer.endsAt != null
      ? Math.max(0, timer.endsAt - now)
      : timer.remainingMs;

  const handleClose = useCallback(() => setOpen(false), []);

  const setDuration = useCallback((durationMs: number) => {
    setTimer((prev) => {
      // Ignore duration changes while a countdown is already in progress.
      if (prev.status === "running" || prev.status === "paused") {
        return prev;
      }
      return {
        status: "idle",
        durationMs,
        endsAt: null,
        remainingMs: durationMs,
      };
    });
    setCustomMinutes(String(Math.round(durationMs / 60000) || 1));
  }, []);

  const handleStart = useCallback(() => {
    setTimer((prev) => {
      // Singleton: never start a second concurrent countdown.
      if (prev.status === "running") {
        return prev;
      }
      const remaining =
        prev.status === "paused" ? prev.remainingMs : prev.durationMs;
      if (remaining <= 0) {
        return prev;
      }
      return {
        ...prev,
        status: "running",
        endsAt: Date.now() + remaining,
        remainingMs: remaining,
      };
    });
  }, []);

  const handlePause = useCallback(() => {
    setTimer((prev) => {
      if (prev.status !== "running" || prev.endsAt == null) {
        return prev;
      }
      return {
        ...prev,
        status: "paused",
        endsAt: null,
        remainingMs: Math.max(0, prev.endsAt - Date.now()),
      };
    });
  }, []);

  const handleReset = useCallback(() => {
    setTimer((prev) => ({
      status: "idle",
      durationMs: prev.durationMs,
      endsAt: null,
      remainingMs: prev.durationMs,
    }));
  }, []);

  const handleCustomApply = useCallback(() => {
    const minutes = Number.parseInt(customMinutes, 10);
    if (!Number.isFinite(minutes) || minutes < 1 || minutes > 180) {
      return;
    }
    setDuration(minutes * 60 * 1000);
  }, [customMinutes, setDuration]);

  const isActive = timer.status === "running" || timer.status === "paused";
  const buttonLabel =
    timer.status === "running" || timer.status === "paused"
      ? `⏱ ${formatMs(displayedRemainingMs)}`
      : timer.status === "expired"
      ? "⏱ Done"
      : "⏱ Timer";

  return (
    <div className="FocusTimer" ref={anchorRef}>
      <button
        type="button"
        className={clsx("FocusTimer__button", {
          active: open,
          running: timer.status === "running",
          expired: timer.status === "expired",
        })}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="dialog"
        data-testid="focus-timer-button"
      >
        {buttonLabel}
      </button>
      {open && popoverPos && (
        <Popover
          top={popoverPos.top}
          left={popoverPos.left}
          fitInViewport
          offsetLeft={appState.offsetLeft}
          offsetTop={appState.offsetTop}
          viewportWidth={appState.width}
          viewportHeight={appState.height}
          onCloseRequest={handleClose}
          className="FocusTimer__popover"
        >
          <Island padding={2} className="FocusTimer__panel">
            <div className="FocusTimer__title">Focus timer</div>
            <div
              className={clsx("FocusTimer__display", {
                expired: timer.status === "expired",
                running: timer.status === "running",
              })}
              data-testid="focus-timer-display"
            >
              {timer.status === "expired"
                ? "00:00"
                : formatMs(displayedRemainingMs)}
            </div>
            {timer.status === "expired" && (
              <div className="FocusTimer__expired-label">Time's up</div>
            )}

            <div className="FocusTimer__presets">
              {PRESETS_MINUTES.map((minutes) => (
                <button
                  key={minutes}
                  type="button"
                  className={clsx("FocusTimer__preset", {
                    selected:
                      !isActive &&
                      timer.status !== "expired" &&
                      timer.durationMs === minutes * 60 * 1000,
                  })}
                  disabled={isActive}
                  onClick={() => setDuration(minutes * 60 * 1000)}
                >
                  {minutes}m
                </button>
              ))}
            </div>

            <div className="FocusTimer__custom">
              <label className="FocusTimer__custom-label" htmlFor="focus-timer-custom">
                Custom (minutes)
              </label>
              <div className="FocusTimer__custom-row">
                <input
                  id="focus-timer-custom"
                  type="number"
                  min={1}
                  max={180}
                  className="FocusTimer__custom-input"
                  value={customMinutes}
                  disabled={isActive}
                  onChange={(event) => setCustomMinutes(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      handleCustomApply();
                    }
                  }}
                />
                <button
                  type="button"
                  className="FocusTimer__custom-apply"
                  disabled={isActive}
                  onClick={handleCustomApply}
                >
                  Set
                </button>
              </div>
            </div>

            <div className="FocusTimer__controls">
              {timer.status === "running" ? (
                <button
                  type="button"
                  className="FocusTimer__control FocusTimer__control--primary"
                  onClick={handlePause}
                  data-testid="focus-timer-pause"
                >
                  Pause
                </button>
              ) : (
                <button
                  type="button"
                  className="FocusTimer__control FocusTimer__control--primary"
                  onClick={handleStart}
                  disabled={
                    timer.status === "idle" && timer.remainingMs <= 0
                  }
                  data-testid="focus-timer-start"
                >
                  {timer.status === "paused" ? "Resume" : "Start"}
                </button>
              )}
              <button
                type="button"
                className="FocusTimer__control"
                onClick={handleReset}
                data-testid="focus-timer-reset"
              >
                Reset
              </button>
            </div>
          </Island>
        </Popover>
      )}
    </div>
  );
};

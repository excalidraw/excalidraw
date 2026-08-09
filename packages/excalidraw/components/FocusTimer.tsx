/** Workshop countdown timer for facilitators — local React state only, no scene side-effects. */
import clsx from "clsx";
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { useUIAppState } from "../context/ui-appState";
import { useI18n } from "../i18n";

import { useExcalidrawSetAppState } from "./App";
import { Island } from "./Island";
import { Popover } from "./Popover";

import "./FocusTimer.scss";

const PRESET_MINUTES = [1, 5, 10, 15] as const;
const PANEL_WIDTH = 260;
const TICK_MS = 250;
const MIN_CUSTOM_MINUTES = 1;
const MAX_CUSTOM_MINUTES = 180;
const MIN_CUSTOM_HOURS = 1;
const MAX_CUSTOM_HOURS = 8;

type TimerState =
  | { status: "idle" }
  | { status: "running"; endsAt: number }
  | { status: "paused"; remainingMs: number }
  | { status: "expired" };

export type CustomDurationUnit = "minutes" | "hours";

/** Formats milliseconds as MM:SS, or H:MM:SS when an hour or longer remains. */
export const formatRemainingMs = (ms: number) => {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(
      seconds,
    ).padStart(2, "0")}`;
  }

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(
    2,
    "0",
  )}`;
};

/** Clamps facilitator-entered custom duration to 1–180 whole minutes. */
export const clampCustomMinutes = (value: number) => {
  if (!Number.isFinite(value)) {
    return MIN_CUSTOM_MINUTES;
  }
  return Math.min(
    MAX_CUSTOM_MINUTES,
    Math.max(MIN_CUSTOM_MINUTES, Math.round(value)),
  );
};

/** Clamps facilitator-entered custom duration to 1–8 whole hours. */
export const clampCustomHours = (value: number) => {
  if (!Number.isFinite(value)) {
    return MIN_CUSTOM_HOURS;
  }
  return Math.min(
    MAX_CUSTOM_HOURS,
    Math.max(MIN_CUSTOM_HOURS, Math.round(value)),
  );
};

/** Converts a custom numeric entry plus unit into total minutes for the timer. */
export const resolveCustomDurationMinutes = (
  value: number,
  unit: CustomDurationUnit,
) =>
  unit === "hours" ? clampCustomHours(value) * 60 : clampCustomMinutes(value);

export const FocusTimer = () => {
  const { t } = useI18n();
  const appState = useUIAppState();
  const setAppState = useExcalidrawSetAppState();

  const [open, setOpen] = useState(false);
  const [timer, setTimer] = useState<TimerState>({ status: "idle" });
  const [selectedPresetMinutes, setSelectedPresetMinutes] = useState<
    (typeof PRESET_MINUTES)[number]
  >(5);
  const [customDuration, setCustomDuration] = useState("");
  const [customDurationUnit, setCustomDurationUnit] =
    useState<CustomDurationUnit>("minutes");
  const [tick, setTick] = useState(0);
  const [popoverPos, setPopoverPos] = useState<{
    top: number;
    left: number;
  } | null>(null);

  const anchorRef = useRef<HTMLDivElement>(null);
  const expiryToastFiredRef = useRef(false);

  useLayoutEffect(() => {
    if (open && anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      setPopoverPos({
        top: rect.bottom + 8,
        left: Math.max(8, rect.right - PANEL_WIDTH),
      });
    }
  }, [open]);

  const handleClose = useCallback(() => setOpen(false), []);

  const getRemainingMs = useCallback((): number | null => {
    if (timer.status === "running") {
      return Math.max(0, timer.endsAt - Date.now());
    }
    if (timer.status === "paused") {
      return timer.remainingMs;
    }
    return null;
  }, [timer, tick]);

  useEffect(() => {
    if (timer.status !== "running") {
      return;
    }

    const intervalId = window.setInterval(() => {
      const remaining = timer.endsAt - Date.now();
      if (remaining <= 0) {
        setTimer({ status: "expired" });
        if (!expiryToastFiredRef.current) {
          expiryToastFiredRef.current = true;
          setAppState({
            toast: {
              message: t("toast.focusTimerExpired"),
              closable: true,
            },
          });
        }
        return;
      }
      setTick((value) => value + 1);
    }, TICK_MS);

    return () => window.clearInterval(intervalId);
  }, [timer, setAppState, t]);

  const handleStart = () => {
    const parsedCustom = customDuration.trim()
      ? resolveCustomDurationMinutes(
          Number(customDuration),
          customDurationUnit,
        )
      : null;
    const minutes = parsedCustom ?? selectedPresetMinutes;

    expiryToastFiredRef.current = false;
    setTimer({
      status: "running",
      endsAt: Date.now() + minutes * 60 * 1000,
    });
  };

  const handlePause = () => {
    if (timer.status !== "running") {
      return;
    }
    setTimer({
      status: "paused",
      remainingMs: Math.max(0, timer.endsAt - Date.now()),
    });
  };

  const handleResume = () => {
    if (timer.status !== "paused") {
      return;
    }
    setTimer({
      status: "running",
      endsAt: Date.now() + timer.remainingMs,
    });
  };

  const handleReset = () => {
    expiryToastFiredRef.current = false;
    setTimer({ status: "idle" });
    setCustomDuration("");
    setCustomDurationUnit("minutes");
  };

  const remainingMs = getRemainingMs();
  const isActive = timer.status === "running" || timer.status === "paused";
  const canStart = timer.status === "idle" || timer.status === "expired";
  const customMin =
    customDurationUnit === "hours" ? MIN_CUSTOM_HOURS : MIN_CUSTOM_MINUTES;
  const customMax =
    customDurationUnit === "hours" ? MAX_CUSTOM_HOURS : MAX_CUSTOM_MINUTES;

  return (
    <div className="FocusTimer" ref={anchorRef}>
      <button
        type="button"
        className={clsx("FocusTimer__button", {
          active: open,
          "FocusTimer__button--running": timer.status === "running",
          "FocusTimer__button--paused": timer.status === "paused",
          "FocusTimer__button--expired": timer.status === "expired",
        })}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="dialog"
        data-testid="focus-timer-button"
      >
        <span className="FocusTimer__button-label">{t("labels.focusTimer")}</span>
        {remainingMs != null && (
          <span className="FocusTimer__badge" data-testid="focus-timer-badge">
            {formatRemainingMs(remainingMs)}
          </span>
        )}
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
            <div className="FocusTimer__title">{t("labels.focusTimerTitle")}</div>

            {timer.status === "expired" && (
              <div
                className="FocusTimer__expired"
                data-testid="focus-timer-expired"
              >
                {t("labels.focusTimerExpired")}
              </div>
            )}

            {remainingMs != null && (
              <div
                className="FocusTimer__display"
                data-testid="focus-timer-display"
              >
                {formatRemainingMs(remainingMs)}
              </div>
            )}

            {canStart && (
              <>
                <div className="FocusTimer__presets">
                  {PRESET_MINUTES.map((minutes) => (
                    <button
                      key={minutes}
                      type="button"
                      className={clsx("FocusTimer__preset", {
                        active:
                          !customDuration.trim() &&
                          selectedPresetMinutes === minutes,
                      })}
                      onClick={() => {
                        setCustomDuration("");
                        setSelectedPresetMinutes(minutes);
                      }}
                      data-testid={`focus-timer-preset-${minutes}`}
                    >
                      {minutes}m
                    </button>
                  ))}
                </div>
                <div className="FocusTimer__custom">
                  <span>{t("labels.focusTimerCustomDuration")}</span>
                  <div className="FocusTimer__unit-toggle">
                    <button
                      type="button"
                      className={clsx("FocusTimer__unit", {
                        active: customDurationUnit === "minutes",
                      })}
                      onClick={() => setCustomDurationUnit("minutes")}
                      data-testid="focus-timer-unit-minutes"
                    >
                      {t("labels.focusTimerUnitMinutes")}
                    </button>
                    <button
                      type="button"
                      className={clsx("FocusTimer__unit", {
                        active: customDurationUnit === "hours",
                      })}
                      onClick={() => setCustomDurationUnit("hours")}
                      data-testid="focus-timer-unit-hours"
                    >
                      {t("labels.focusTimerUnitHours")}
                    </button>
                  </div>
                  <input
                    type="number"
                    min={customMin}
                    max={customMax}
                    value={customDuration}
                    onChange={(event) => setCustomDuration(event.target.value)}
                    placeholder={
                      customDurationUnit === "hours"
                        ? "1"
                        : String(selectedPresetMinutes)
                    }
                    data-testid="focus-timer-custom-duration"
                  />
                </div>
              </>
            )}

            <div className="FocusTimer__controls">
              {canStart && (
                <button
                  type="button"
                  className="FocusTimer__control FocusTimer__control--primary"
                  onClick={handleStart}
                  disabled={isActive}
                  data-testid="focus-timer-start"
                >
                  {t("labels.focusTimerStart")}
                </button>
              )}
              {timer.status === "running" && (
                <button
                  type="button"
                  className="FocusTimer__control"
                  onClick={handlePause}
                  data-testid="focus-timer-pause"
                >
                  {t("labels.focusTimerPause")}
                </button>
              )}
              {timer.status === "paused" && (
                <button
                  type="button"
                  className="FocusTimer__control FocusTimer__control--primary"
                  onClick={handleResume}
                  data-testid="focus-timer-resume"
                >
                  {t("labels.focusTimerResume")}
                </button>
              )}
              {timer.status !== "idle" && (
                <button
                  type="button"
                  className="FocusTimer__control"
                  onClick={handleReset}
                  data-testid="focus-timer-reset"
                >
                  {t("labels.focusTimerReset")}
                </button>
              )}
            </div>
          </Island>
        </Popover>
      )}
    </div>
  );
};

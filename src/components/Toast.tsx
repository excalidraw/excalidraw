import { useCallback, useEffect, useRef } from "react";
import { TOAST_TIMEOUT } from "../constants";
import { close } from "./icons";
import "./Toast.scss";
import { ToolButton } from "./ToolButton";

export const Toast = ({
  message,
  clearToast,
  closable = true,
  // pass null to prevent auto dismiss
  duration,
}: {
  message: string;
  clearToast: () => void;
  closable?: boolean;
  duration?: number | null;
}) => {
  const timerRef = useRef<number>(0);
  const toastDuration = duration === undefined ? TOAST_TIMEOUT : duration;
  const scheduleTimeout = useCallback(() => {
    if (!toastDuration) {
      return;
    }
    timerRef.current = window.setTimeout(() => clearToast(), toastDuration);
  }, [clearToast, toastDuration]);

  useEffect(() => {
    if (!toastDuration) {
      return;
    }
    scheduleTimeout();
    return () => clearTimeout(timerRef.current);
  }, [scheduleTimeout, message, toastDuration]);

  const onMouseEnter = toastDuration
    ? () => clearTimeout(timerRef?.current)
    : undefined;
  const onMouseLeave = toastDuration ? scheduleTimeout : undefined;
  return (
    <div
      className="Toast"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <p className="Toast__message">{message}</p>
      {closable && (
        <ToolButton
          icon={close}
          aria-label="close"
          type="icon"
          onClick={clearToast}
          className="close"
        />
      )}
    </div>
  );
};

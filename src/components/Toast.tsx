import { useCallback, useEffect, useRef } from "react";
import { close } from "./icons";
import "./Toast.scss";
import { ToolButton } from "./ToolButton";

const DEFAULT_TOAST_TIMEOUT = 5000;

export const Toast = ({
  message,
  clearToast,
  closable = true,
  // To prevent autoclose, pass duration as Infinity
  duration = DEFAULT_TOAST_TIMEOUT,
}: {
  message: string;
  clearToast: () => void;
  closable?: boolean;
  duration?: number;
}) => {
  const timerRef = useRef<number>(0);
  const shouldAutoClose = duration !== Infinity;
  const scheduleTimeout = useCallback(() => {
    if (!shouldAutoClose) {
      return;
    }
    timerRef.current = window.setTimeout(() => clearToast(), duration);
  }, [clearToast, duration, shouldAutoClose]);

  useEffect(() => {
    if (!shouldAutoClose) {
      return;
    }
    scheduleTimeout();
    return () => clearTimeout(timerRef.current);
  }, [scheduleTimeout, message, duration, shouldAutoClose]);

  const onMouseEnter = shouldAutoClose
    ? () => clearTimeout(timerRef?.current)
    : undefined;
  const onMouseLeave = shouldAutoClose ? scheduleTimeout : undefined;
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

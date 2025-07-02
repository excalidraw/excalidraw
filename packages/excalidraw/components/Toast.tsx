import { useCallback, useEffect, useRef } from "react";
import clsx from "clsx";

import { CloseIcon } from "./icons";
import { ToolButton } from "./ToolButton";

import "./Toast.scss";

import type { CSSProperties } from "react";

export type ToastType = "info" | "warning";

const DEFAULT_TOAST_TIMEOUT = 5000;

export const Toast = ({
  message,
  onClose,
  closable = false,
  // To prevent autoclose, pass duration as Infinity
  duration = DEFAULT_TOAST_TIMEOUT,
  type = "info",
  style,
}: {
  message: string;
  onClose: () => void;
  closable?: boolean;
  duration?: number;
  type?: ToastType;
  style?: CSSProperties;
}) => {
  const timerRef = useRef<number>(0);
  const shouldAutoClose = duration !== Infinity;
  const scheduleTimeout = useCallback(() => {
    if (!shouldAutoClose) {
      return;
    }
    timerRef.current = window.setTimeout(() => onClose(), duration);
  }, [onClose, duration, shouldAutoClose]);

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
      className={clsx("Toast", `Toast--${type}`)}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={style}
    >
      <p className="Toast__message">{message}</p>
      {closable && (
        <ToolButton
          icon={CloseIcon}
          aria-label="close"
          type="icon"
          onClick={onClose}
          className="close"
        />
      )}
    </div>
  );
};

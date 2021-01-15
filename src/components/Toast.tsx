import React, { useCallback, useEffect, useRef } from "react";
import { TOAST_TIMEOUT } from "../constants";
import "./Toast.scss";

export const Toast = ({
  message,
  clearToast,
}: {
  message: string;
  clearToast: () => void;
}) => {
  const timerRef = useRef<number>(0);

  const scheduleTimeout = useCallback(
    () =>
      (timerRef.current = window.setTimeout(() => clearToast(), TOAST_TIMEOUT)),
    [clearToast],
  );

  useEffect(() => {
    scheduleTimeout();
    return () => clearTimeout(timerRef.current);
  }, [scheduleTimeout, message]);

  return (
    <div
      className="Toast"
      onMouseEnter={() => clearTimeout(timerRef?.current)}
      onMouseLeave={scheduleTimeout}
    >
      <p className="Toast__message">{message}</p>
    </div>
  );
};

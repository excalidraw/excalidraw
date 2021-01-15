import React, { useEffect, useState } from "react";
import { TOAST_TIMEOUT } from "../constants";
import "./Toast.scss";

export const Toast = ({
  message,
  clearToast,
}: {
  message: string | null;
  clearToast: Function;
}) => {
  const [shouldClear, setShouldClear] = useState(true);

  useEffect(() => {
    if (message !== null) {
      const timeout = setTimeout(() => {
        if (shouldClear) {
          clearToast();
        }
      }, TOAST_TIMEOUT);
      return () => clearTimeout(timeout);
    }
  }, [shouldClear, clearToast, message]);

  const handleMouseLeave = (
    event: React.MouseEvent<HTMLDivElement, MouseEvent>,
  ) => {
    clearToast();
    setShouldClear(true);
  };

  return message ? (
    <div
      className="Toast"
      onMouseOver={() => setShouldClear(false)}
      onMouseLeave={handleMouseLeave}
    >
      <p className="Toast__message">{message}</p>
    </div>
  ) : null;
};

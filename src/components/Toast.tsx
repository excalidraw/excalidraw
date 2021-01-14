import React, { useEffect } from "react";
import "./Toast.scss";

export const Toast = ({
  message,
  clearToast,
}: {
  message: string | null;
  clearToast: Function;
}) => {
  useEffect(() => {
    if (message !== null) {
      const timeout = setTimeout(clearToast, 2000);
      return () => clearTimeout(timeout);
    }
  });

  return message ? (
    <div className="toast">
      <p className="toast__message">{message}</p>
    </div>
  ) : null;
};

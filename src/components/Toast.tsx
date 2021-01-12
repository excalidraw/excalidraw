import React, { useState, useEffect } from "react";
import "./Toast.scss";

export const Toast = ({
  message,
  clearToast,
}: {
  message: string | null;
  clearToast: Function;
}) => {
  const [toastMessage, setToastMessage] = useState<string | null>(message);

  useEffect(() => {
    setToastMessage(message);
  }, [message]);

  useEffect(() => {
    const interval = setInterval(() => {
      clearToast(null);
    }, 2000);

    return () => {
      clearInterval(interval);
    };
  }, [clearToast]);

  return toastMessage ? (
    <div className="toast">
      <p className="toast__message">{toastMessage}</p>
    </div>
  ) : null;
};

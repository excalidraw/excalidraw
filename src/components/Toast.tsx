import React, { useEffect, useState } from "react";
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
      }, 2000);
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
      className="toast"
      onMouseOver={() => setShouldClear(false)}
      onMouseLeave={handleMouseLeave}
    >
      <p className="toast__message">{message}</p>
    </div>
  ) : null;
};

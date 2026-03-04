import { CloseIcon } from "../icons";

import "./CanvasNotification.scss";

import type { CanvasNotification as CanvasNotificationType } from "../../types";

interface CanvasNotificationProps {
  notification: CanvasNotificationType;
}

const CanvasNotification = ({ notification }: CanvasNotificationProps) => {
  const style: React.CSSProperties = {};
  if (notification.color) {
    style.backgroundColor = notification.color;
  }
  if (notification.textColor) {
    style.color = notification.textColor;
  }

  return (
    <>
      {notification.borderColor && (
        <div
          className="canvas-notification__border"
          style={{ borderColor: notification.borderColor }}
        />
      )}
      <div className="canvas-notification" style={style}>
        <div className="canvas-notification__label">
          {notification.icon && (
            <span className="canvas-notification__icon">
              {notification.icon}
            </span>
          )}
          {notification.label}
        </div>
        {notification.onDismiss && (
          <button
            type="button"
            onClick={notification.onDismiss}
            className="canvas-notification__dismiss-btn"
          >
            {CloseIcon}
          </button>
        )}
      </div>
    </>
  );
};

export default CanvasNotification;

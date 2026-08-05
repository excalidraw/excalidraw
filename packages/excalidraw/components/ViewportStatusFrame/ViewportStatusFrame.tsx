import { t } from "../../i18n";
import { CloseIcon } from "../icons";

import "./ViewportStatusFrame.scss";

import type { ViewportStatusFrame as ViewportStatusFrameType } from "../../types";

interface ViewportStatusFrameProps {
  status: ViewportStatusFrameType;
}

const ViewportStatusFrame = ({ status }: ViewportStatusFrameProps) => {
  const { border, label } = status;

  return (
    <>
      {border && (
        <div
          className="viewport-status-frame__border"
          style={{ borderColor: border }}
        />
      )}
      {label && (
        <div
          className="viewport-status-frame__badge"
          role="status"
          style={{
            backgroundColor: label.background || border || undefined,
            color: label.color,
          }}
        >
          <div className="viewport-status-frame__badge-label">
            {label.icon && (
              <span className="viewport-status-frame__badge-icon">
                {label.icon}
              </span>
            )}
            {label.label}
          </div>
          {label.onClose && (
            <button
              type="button"
              className="viewport-status-frame__badge-close"
              aria-label={t("buttons.close")}
              onClick={label.onClose}
            >
              {CloseIcon}
            </button>
          )}
        </div>
      )}
    </>
  );
};

export default ViewportStatusFrame;

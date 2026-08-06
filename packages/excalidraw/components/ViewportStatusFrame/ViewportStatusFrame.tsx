import { useId } from "react";

import clsx from "clsx";

import { t } from "../../i18n";
import { CloseIcon } from "../icons";

import "./ViewportStatusFrame.scss";

import type { CSSProperties } from "react";

import type { ViewportStatusFrame as ViewportStatusFrameType } from "../../types";

export const ViewportStatusBorder = ({
  border,
  style,
}: {
  border: string;
  style?: CSSProperties;
}) => (
  <div
    className="viewport-status-frame__border"
    style={{ borderColor: border, ...style }}
  />
);

export const ViewportStatusBadge = ({
  label,
  border,
}: {
  label: NonNullable<ViewportStatusFrameType["label"]>;
  border?: ViewportStatusFrameType["border"];
}) => {
  const labelId = useId();
  const labelContent = (
    <>
      {label.icon && (
        <span className="viewport-status-frame__badge-icon">{label.icon}</span>
      )}
      {label.label}
    </>
  );

  return (
    <div
      className={clsx("viewport-status-frame__badge", {
        "viewport-status-frame__badge--clickable": label.onClick,
      })}
      role="status"
      style={{
        ["--viewport-status-frame-badge-background" as string]:
          label.background || border || "var(--color-primary)",
        color: label.color,
      }}
    >
      {label.onClick && (
        <button
          type="button"
          className="viewport-status-frame__badge-action"
          aria-labelledby={labelId}
          onClick={label.onClick}
        />
      )}
      <div
        className="viewport-status-frame__badge-label"
        id={label.onClick ? labelId : undefined}
      >
        {labelContent}
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
  );
};

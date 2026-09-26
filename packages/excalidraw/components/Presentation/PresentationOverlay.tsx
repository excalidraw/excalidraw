import { useEffect, useState } from "react";

import clsx from "clsx";

import { t } from "../../i18n";
import { chevronRight, CloseIcon } from "../icons";

import "./PresentationOverlay.scss";

import type { ReactNode } from "react";

import type App from "../App";

const ControlButton = ({
  app,
  label,
  icon,
  className,
  disabled,
  onClick,
}: {
  app: App;
  label: string;
  icon: ReactNode;
  className?: string;
  disabled?: boolean;
  onClick: () => void;
}) => (
  <button
    type="button"
    className={clsx("presentation-controls__button", className)}
    aria-label={label}
    title={label}
    disabled={disabled}
    onClick={() => {
      onClick();
      // keep keyboard navigation on the canvas
      app.focusContainer();
    }}
  >
    {icon}
  </button>
);

/** how long the slide controls stay visible after the pointer last moved */
const CONTROLS_HIDE_DELAY = 2500;

export const PresentationOverlay = ({ app }: { app: App }) => {
  const [controlsVisible, setControlsVisible] = useState(true);

  useEffect(() => {
    const container = app.excalidrawContainerValue.container;
    let timeout = 0;
    const show = () => {
      setControlsVisible(true);
      app.ownerWindow.clearTimeout(timeout);
      timeout = app.ownerWindow.setTimeout(
        () => setControlsVisible(false),
        CONTROLS_HIDE_DELAY,
      );
    };
    show();
    container?.addEventListener("pointermove", show);
    return () => {
      app.ownerWindow.clearTimeout(timeout);
      container?.removeEventListener("pointermove", show);
    };
  }, [app]);

  const frame = app.presentation.getCurrentFrame();
  if (!frame) {
    return null;
  }

  const slides = app.presentation.getSlides();
  const index = slides.findIndex((slide) => slide.id === frame.id);
  const { scrollX, scrollY, zoom } = app.state;

  return (
    <div className="presentation-overlay">
      <div
        className="presentation-overlay__slide"
        data-testid="presentation-slide"
        style={{
          left: (frame.x + scrollX) * zoom.value,
          top: (frame.y + scrollY) * zoom.value,
          width: frame.width * zoom.value,
          height: frame.height * zoom.value,
        }}
      />
      <div
        className={clsx("presentation-controls", {
          "presentation-controls--hidden": !controlsVisible,
        })}
        title={t("presentation.hint")}
      >
        <ControlButton
          app={app}
          label={t("presentation.previous")}
          icon={chevronRight}
          className="presentation-controls__button--prev"
          disabled={index <= 0}
          onClick={app.presentation.prev}
        />
        <span
          className="presentation-controls__counter"
          data-testid="presentation-counter"
        >
          {t("presentation.slideCounter", {
            current: index + 1,
            total: slides.length,
          })}
        </span>
        <ControlButton
          app={app}
          label={t("presentation.next")}
          icon={chevronRight}
          disabled={index >= slides.length - 1}
          onClick={app.presentation.next}
        />
        <ControlButton
          app={app}
          label={t("presentation.stop")}
          icon={CloseIcon}
          onClick={app.presentation.stop}
        />
      </div>
    </div>
  );
};

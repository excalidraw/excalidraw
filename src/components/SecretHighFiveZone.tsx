import React from "react";

import { debounce, throttle } from "../utils";
import { close } from "./icons";
import { t } from "../i18n";

import { ReactComponent as HighFiveIcon } from "./high-five.svg";

import "./SecretHighFiveZone.css";

export function SecretHighFiveZone(props: {
  isVisible: boolean;
  onClose: () => void;
  pointerViewportCoordList: Array<{ x: number; y: number }>;
}) {
  const { isVisible, onClose, pointerViewportCoordList } = props;

  if (!isVisible) {
    // bail out if the zone is hidden (i.e. call the hook conditionally)
    return null;
  }

  return (
    <SecretHighFiveZoneImpl
      onClose={onClose}
      pointerViewportCoordList={pointerViewportCoordList}
    />
  );
}

function SecretHighFiveZoneImpl(props: {
  onClose: () => void;
  pointerViewportCoordList: Array<{ x: number; y: number }>;
}) {
  const { onClose, pointerViewportCoordList } = props;

  const {
    rootElementRef,
    numberOfPointersOnElement,
  } = useNumberOfPointersOnElement(pointerViewportCoordList);

  return (
    <div className="SecretHighFiveZone" ref={rootElementRef}>
      <HighFiveIcon
        className="SecretHighFiveZone-hands"
        style={
          numberOfPointersOnElement === 0
            ? {}
            : {
                animationDuration: `${2000 / numberOfPointersOnElement}ms`,
              }
        }
      />
      <div className="SecretHighFiveZone-text">High Five Zone</div>
      <button
        className="Modal__close SecretHighFiveZone-closeButton"
        onClick={onClose}
        aria-label={t("buttons.close")}
      >
        {close}
      </button>
    </div>
  );
}

function useNumberOfPointersOnElement(
  pointerViewportCoordList: Array<{ x: number; y: number }>,
): {
  rootElementRef: React.Ref<HTMLDivElement>;
  numberOfPointersOnElement: number;
} {
  const [selfPointerCoord, setSelfPointerCoord] = React.useState<{
    x: number;
    y: number;
  } | null>(null);
  const [zoneCoord, setZoneCoord] = React.useState<{
    top: number;
    right: number;
    bottom: number;
    left: number;
  } | null>(null);

  const rootElementRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const zoneElement = rootElementRef.current;

    const updateSelfPointer = (event: MouseEvent) => {
      setSelfPointerCoord({
        x: event.clientX,
        y: event.clientY,
      });
    };
    const throttledUpdateSelfPointer = throttle(updateSelfPointer, 100);

    const updateZoneCoord = () => {
      const boundingRect = zoneElement?.getBoundingClientRect();
      if (boundingRect) {
        setZoneCoord({
          top: boundingRect.top,
          right: boundingRect.right,
          bottom: boundingRect.bottom,
          left: boundingRect.left,
        });
      }
    };
    const debouncedUpdateZoneCoord = debounce(updateZoneCoord, 500);

    updateZoneCoord();

    window.addEventListener("resize", debouncedUpdateZoneCoord);
    // NOTE: need to use a global mousemove listener here to detect the hover state
    // because the zone's root element uses `pointer-events: none`.
    // However the listeners are only active when the zone is shown,
    // so the perf impact should be ok.
    window.addEventListener("mousemove", throttledUpdateSelfPointer);

    return () => {
      window.removeEventListener("resize", debouncedUpdateZoneCoord);
      window.removeEventListener("mousemove", throttledUpdateSelfPointer);
    };
  }, []);

  let numberOfPointersOnElement = 0;

  if (selfPointerCoord && zoneCoord) {
    for (const { x, y } of [...pointerViewportCoordList, selfPointerCoord]) {
      if (
        x > zoneCoord.left &&
        x < zoneCoord.right &&
        y > zoneCoord.top &&
        y < zoneCoord.bottom
      ) {
        numberOfPointersOnElement += 1;
      }
    }
  }

  return {
    rootElementRef,
    numberOfPointersOnElement,
  };
}

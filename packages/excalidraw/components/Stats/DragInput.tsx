import { useEffect, useMemo, useRef, useState } from "react";
import throttle from "lodash.throttle";
import { EVENT } from "../../constants";
import { KEYS } from "../../keys";
import type { ExcalidrawElement } from "../../element/types";
import { deepCopyElement } from "../../element/newElement";

import "./DragInput.scss";
import clsx from "clsx";

export type DragInputCallbackType = (
  accumulatedChange: number,
  instantChange: number,
  stateAtStart: ExcalidrawElement,
  shouldKeepAspectRatio: boolean,
  shouldChangeByStepSize: boolean,
  nextValue?: number,
) => void;

interface StatsDragInputProps {
  label: string | React.ReactNode;
  value: number;
  element: ExcalidrawElement;
  editable?: boolean;
  shouldKeepAspectRatio?: boolean;
  dragInputCallback: DragInputCallbackType;
}

const StatsDragInput = ({
  label,
  dragInputCallback,
  value,
  element,
  editable = true,
  shouldKeepAspectRatio,
}: StatsDragInputProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);

  const cbThrottled = useMemo(() => {
    return throttle(dragInputCallback, 16);
  }, [dragInputCallback]);

  const [inputValue, setInputValue] = useState(value.toString());

  useEffect(() => {
    setInputValue(value.toString());
  }, [value]);

  return (
    <div className={clsx("drag-input-container", !editable && "disabled")}>
      <div
        className="drag-input-label"
        ref={labelRef}
        onPointerDown={(event) => {
          if (inputRef.current && editable) {
            let startValue = Number(inputRef.current.value);
            if (isNaN(startValue)) {
              startValue = 0;
            }

            let lastPointer: {
              x: number;
              y: number;
            } | null = null;

            let stateAtStart: ExcalidrawElement | null = null;

            let accumulatedChange: number | null = null;

            document.body.classList.add("dragResize");

            const onPointerMove = (event: PointerEvent) => {
              if (!stateAtStart) {
                stateAtStart = deepCopyElement(element);
              }

              if (!accumulatedChange) {
                accumulatedChange = 0;
              }

              if (lastPointer && stateAtStart && accumulatedChange !== null) {
                const instantChange = event.clientX - lastPointer.x;
                accumulatedChange += instantChange;

                cbThrottled(
                  accumulatedChange,
                  instantChange,
                  stateAtStart,
                  shouldKeepAspectRatio!!,
                  event.shiftKey,
                );
              }

              lastPointer = {
                x: event.clientX,
                y: event.clientY,
              };
            };

            window.addEventListener(EVENT.POINTER_MOVE, onPointerMove, false);
            window.addEventListener(
              EVENT.POINTER_UP,
              () => {
                window.removeEventListener(
                  EVENT.POINTER_MOVE,
                  onPointerMove,
                  false,
                );

                lastPointer = null;
                accumulatedChange = null;
                stateAtStart = null;

                document.body.classList.remove("dragResize");
              },
              false,
            );
          }
        }}
        onPointerEnter={() => {
          if (labelRef.current) {
            labelRef.current.style.cursor = "ew-resize";
          }
        }}
      >
        {label}
      </div>
      <input
        className="drag-input"
        autoComplete="off"
        spellCheck="false"
        onKeyDown={(event) => {
          if (editable) {
            const eventTarget = event.target;

            if (
              eventTarget instanceof HTMLInputElement &&
              event.key === KEYS.ENTER
            ) {
              const v = Number(eventTarget.value);
              if (isNaN(v)) {
                setInputValue(value.toString());
                return;
              }
              dragInputCallback(
                0,
                0,
                element,
                shouldKeepAspectRatio!!,
                false,
                v,
              );
            }
          }
        }}
        ref={inputRef}
        value={inputValue}
        onChange={(event) => {
          const eventTarget = event.target;
          if (eventTarget instanceof HTMLInputElement) {
            setInputValue(event.target.value);
          }
        }}
        onBlur={() => {
          if (!inputValue) {
            setInputValue(value.toString());
          }
        }}
        disabled={!editable}
      ></input>
    </div>
  );
};

export default StatsDragInput;

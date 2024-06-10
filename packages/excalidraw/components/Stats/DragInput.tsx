import { useEffect, useMemo, useRef, useState } from "react";
import throttle from "lodash.throttle";
import { EVENT } from "../../constants";
import { KEYS } from "../../keys";
import type { ElementsMap, ExcalidrawElement } from "../../element/types";
import { deepCopyElement } from "../../element/newElement";

import "./DragInput.scss";
import clsx from "clsx";
import { useApp } from "../App";
import { InlineIcon } from "../InlineIcon";

export type DragInputCallbackType = ({
  accumulatedChange,
  instantChange,
  originalElements,
  originalElementsMap,
  shouldKeepAspectRatio,
  shouldChangeByStepSize,
  nextValue,
}: {
  accumulatedChange: number;
  instantChange: number;
  originalElements: ExcalidrawElement[];
  originalElementsMap: ElementsMap;
  shouldKeepAspectRatio: boolean;
  shouldChangeByStepSize: boolean;
  nextValue?: number;
}) => void;

interface StatsDragInputProps {
  label: string | React.ReactNode;
  icon?: React.ReactNode;
  value: number | "Mixed";
  elements: ExcalidrawElement[];
  editable?: boolean;
  shouldKeepAspectRatio?: boolean;
  dragInputCallback: DragInputCallbackType;
}

const StatsDragInput = ({
  label,
  icon,
  dragInputCallback,
  value,
  elements,
  editable = true,
  shouldKeepAspectRatio,
}: StatsDragInputProps) => {
  const app = useApp();
  const inputRef = useRef<HTMLInputElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);

  const cbThrottled = useMemo(() => {
    return throttle(dragInputCallback, 16);
  }, [dragInputCallback]);

  const [inputValue, setInputValue] = useState(value.toString());

  useEffect(() => {
    setInputValue(value.toString());
  }, [value, elements]);

  const handleInputValue = (v: number) => {
    if (isNaN(v)) {
      setInputValue(value.toString());
      return;
    }
    const roundedV = v.toFixed(2);
    dragInputCallback({
      accumulatedChange: 0,
      instantChange: 0,
      originalElements: elements,
      originalElementsMap: app.scene.getNonDeletedElementsMap(),
      shouldKeepAspectRatio: shouldKeepAspectRatio!!,
      shouldChangeByStepSize: false,
      nextValue: Number(roundedV),
    });
    app.store.shouldCaptureIncrement();
  };

  return editable ? (
    <div
      className={clsx("drag-input-container", !editable && "disabled")}
      data-testid={label}
    >
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

            let stateAtStart: ExcalidrawElement[] | null = null;
            let originalElementsMap: Map<string, ExcalidrawElement> | null =
              null;

            let accumulatedChange: number | null = null;

            document.body.classList.add("dragResize");

            const onPointerMove = (event: PointerEvent) => {
              if (!stateAtStart) {
                stateAtStart = elements.map((element) =>
                  deepCopyElement(element),
                );
              }

              if (!originalElementsMap) {
                originalElementsMap = app.scene
                  .getNonDeletedElements()
                  .reduce((acc, element) => {
                    acc.set(element.id, deepCopyElement(element));
                    return acc;
                  }, new Map() as ElementsMap);
              }

              if (!accumulatedChange) {
                accumulatedChange = 0;
              }

              if (lastPointer && stateAtStart && accumulatedChange !== null) {
                const instantChange = event.clientX - lastPointer.x;
                accumulatedChange += instantChange;

                cbThrottled({
                  accumulatedChange,
                  instantChange,
                  originalElements: stateAtStart,
                  originalElementsMap,
                  shouldKeepAspectRatio: shouldKeepAspectRatio!!,
                  shouldChangeByStepSize: event.shiftKey,
                });
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

                app.store.shouldCaptureIncrement();

                lastPointer = null;
                accumulatedChange = null;
                stateAtStart = null;
                originalElementsMap = null;

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
        {icon ? <InlineIcon icon={icon} /> : label}
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
              handleInputValue(v);
              eventTarget.blur();
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
        onBlur={(event) => {
          if (!inputValue) {
            setInputValue(value.toString());
          } else if (editable) {
            const eventTarget = event.target;

            if (eventTarget instanceof HTMLInputElement) {
              const v = Number(eventTarget.value);
              handleInputValue(v);
              app.store.shouldCaptureIncrement();
            }
          }
        }}
        disabled={!editable}
      ></input>
    </div>
  ) : (
    <></>
  );
};

export default StatsDragInput;

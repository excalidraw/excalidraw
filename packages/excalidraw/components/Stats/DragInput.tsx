import { useEffect, useRef, useState } from "react";
import { EVENT } from "../../constants";
import { KEYS } from "../../keys";
import type { ElementsMap, ExcalidrawElement } from "../../element/types";
import { deepCopyElement } from "../../element/newElement";
import clsx from "clsx";
import { useApp } from "../App";
import { InlineIcon } from "../InlineIcon";
import type { StatsInputProperty } from "./utils";
import { SMALLEST_DELTA } from "./utils";
import { StoreAction } from "../../store";
import type Scene from "../../scene/Scene";

import "./DragInput.scss";
import type { AppState } from "../../types";
import { cloneJSON } from "../../utils";

export type DragInputCallbackType<
  P extends StatsInputProperty,
  E = ExcalidrawElement,
> = (props: {
  accumulatedChange: number;
  instantChange: number;
  originalElements: readonly E[];
  originalElementsMap: ElementsMap;
  shouldKeepAspectRatio: boolean;
  shouldChangeByStepSize: boolean;
  scene: Scene;
  nextValue?: number;
  property: P;
  originalAppState: AppState;
  setInputValue: (value: number) => void;
}) => void;

interface StatsDragInputProps<
  T extends StatsInputProperty,
  E = ExcalidrawElement,
> {
  label: string | React.ReactNode;
  icon?: React.ReactNode;
  value: number | "Mixed";
  elements: readonly E[];
  editable?: boolean;
  shouldKeepAspectRatio?: boolean;
  dragInputCallback: DragInputCallbackType<T, E>;
  property: T;
  scene: Scene;
  appState: AppState;
  /** how many px you need to drag to get 1 unit change */
  sensitivity?: number;
}

const StatsDragInput = <
  T extends StatsInputProperty,
  E extends ExcalidrawElement = ExcalidrawElement,
>({
  label,
  icon,
  dragInputCallback,
  value,
  elements,
  editable = true,
  shouldKeepAspectRatio,
  property,
  scene,
  appState,
  sensitivity = 1,
}: StatsDragInputProps<T, E>) => {
  const app = useApp();
  const inputRef = useRef<HTMLInputElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);

  const [inputValue, setInputValue] = useState(value.toString());

  const stateRef = useRef<{
    originalAppState: AppState;
    originalElements: readonly E[];
    lastUpdatedValue: string;
    updatePending: boolean;
  }>(null!);
  if (!stateRef.current) {
    stateRef.current = {
      originalAppState: cloneJSON(appState),
      originalElements: elements,
      lastUpdatedValue: inputValue,
      updatePending: false,
    };
  }

  useEffect(() => {
    const inputValue = value.toString();
    setInputValue(inputValue);
    stateRef.current.lastUpdatedValue = inputValue;
  }, [value]);

  const handleInputValue = (
    updatedValue: string,
    elements: readonly E[],
    appState: AppState,
  ) => {
    if (!stateRef.current.updatePending) {
      return false;
    }
    stateRef.current.updatePending = false;

    const parsed = Number(updatedValue);
    if (isNaN(parsed)) {
      setInputValue(value.toString());
      return;
    }

    const rounded = Number(parsed.toFixed(2));
    const original = Number(value);

    // only update when
    // 1. original was "Mixed" and we have a new value
    // 2. original was not "Mixed" and the difference between a new value and previous value is greater
    //    than the smallest delta allowed, which is 0.01
    // reason: idempotent to avoid unnecessary
    if (isNaN(original) || Math.abs(rounded - original) >= SMALLEST_DELTA) {
      stateRef.current.lastUpdatedValue = updatedValue;
      dragInputCallback({
        accumulatedChange: 0,
        instantChange: 0,
        originalElements: elements,
        originalElementsMap: app.scene.getNonDeletedElementsMap(),
        shouldKeepAspectRatio: shouldKeepAspectRatio!!,
        shouldChangeByStepSize: false,
        scene,
        nextValue: rounded,
        property,
        originalAppState: appState,
        setInputValue: (value) => setInputValue(String(value)),
      });
      app.syncActionResult({ storeAction: StoreAction.CAPTURE });
    }
  };

  const callbacksRef = useRef<
    Partial<{
      handleInputValue: typeof handleInputValue;
      onPointerUp: (event: PointerEvent) => void;
      onPointerMove: (event: PointerEvent) => void;
    }>
  >({});
  callbacksRef.current.handleInputValue = handleInputValue;

  // make sure that clicking on canvas (which umounts the component)
  // updates current input value (blur isn't triggered)
  useEffect(() => {
    const input = inputRef.current;
    const callbacks = callbacksRef.current;
    return () => {
      const nextValue = input?.value;
      if (nextValue) {
        callbacks.handleInputValue?.(
          nextValue,
          stateRef.current.originalElements,
          stateRef.current.originalAppState,
        );
      }

      // generally not needed, but in case `pointerup` doesn't fire and
      // we don't remove the listeners that way, we should at least remove
      // on unmount
      window.removeEventListener(
        EVENT.POINTER_MOVE,
        callbacks.onPointerMove!,
        false,
      );
      window.removeEventListener(
        EVENT.POINTER_UP,
        callbacks.onPointerUp!,
        false,
      );
    };
  }, [
    // we need to track change of `editable` state as mount/unmount
    // because react doesn't trigger `blur` when a an input is blurred due
    // to being disabled (https://github.com/facebook/react/issues/9142).
    // As such, if we keep rendering disabled inputs, then change in selection
    // to an element that has a given property as non-editable would not trigger
    // blur/unmount and wouldn't update the value.
    editable,
  ]);

  if (!editable) {
    return null;
  }

  return (
    <div
      className={clsx("drag-input-container", !editable && "disabled")}
      data-testid={label}
    >
      <div
        className="drag-input-label"
        ref={labelRef}
        onPointerDown={(event) => {
          if (inputRef.current && editable) {
            document.body.classList.add("excalidraw-cursor-resize");

            let startValue = Number(inputRef.current.value);
            if (isNaN(startValue)) {
              startValue = 0;
            }

            let lastPointer: {
              x: number;
              y: number;
            } | null = null;

            let originalElementsMap: Map<string, ExcalidrawElement> | null =
              app.scene
                .getNonDeletedElements()
                .reduce((acc: ElementsMap, element) => {
                  acc.set(element.id, deepCopyElement(element));
                  return acc;
                }, new Map());

            let originalElements: readonly E[] | null = elements.map(
              (element) => originalElementsMap!.get(element.id) as E,
            );

            const originalAppState: AppState = cloneJSON(appState);

            let accumulatedChange = 0;
            let stepChange = 0;

            const onPointerMove = (event: PointerEvent) => {
              if (
                lastPointer &&
                originalElementsMap !== null &&
                originalElements !== null
              ) {
                const instantChange = event.clientX - lastPointer.x;

                if (instantChange !== 0) {
                  stepChange += instantChange;

                  if (Math.abs(stepChange) >= sensitivity) {
                    stepChange =
                      Math.sign(stepChange) *
                      Math.floor(Math.abs(stepChange) / sensitivity);

                    accumulatedChange += stepChange;

                    dragInputCallback({
                      accumulatedChange,
                      instantChange: stepChange,
                      originalElements,
                      originalElementsMap,
                      shouldKeepAspectRatio: shouldKeepAspectRatio!!,
                      shouldChangeByStepSize: event.shiftKey,
                      property,
                      scene,
                      originalAppState,
                      setInputValue: (value) => setInputValue(String(value)),
                    });

                    stepChange = 0;
                  }
                }
              }

              lastPointer = {
                x: event.clientX,
                y: event.clientY,
              };
            };

            const onPointerUp = () => {
              window.removeEventListener(
                EVENT.POINTER_MOVE,
                onPointerMove,
                false,
              );

              app.syncActionResult({ storeAction: StoreAction.CAPTURE });

              lastPointer = null;
              accumulatedChange = 0;
              stepChange = 0;
              originalElements = null;
              originalElementsMap = null;

              document.body.classList.remove("excalidraw-cursor-resize");

              window.removeEventListener(EVENT.POINTER_UP, onPointerUp, false);
            };

            callbacksRef.current.onPointerMove = onPointerMove;
            callbacksRef.current.onPointerUp = onPointerUp;

            window.addEventListener(EVENT.POINTER_MOVE, onPointerMove, false);
            window.addEventListener(EVENT.POINTER_UP, onPointerUp, false);
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
              handleInputValue(eventTarget.value, elements, appState);
              app.focusContainer();
            }
          }
        }}
        ref={inputRef}
        value={inputValue}
        onChange={(event) => {
          stateRef.current.updatePending = true;
          setInputValue(event.target.value);
        }}
        onFocus={(event) => {
          event.target.select();
          stateRef.current.originalElements = elements;
          stateRef.current.originalAppState = cloneJSON(appState);
        }}
        onBlur={(event) => {
          if (!inputValue) {
            setInputValue(value.toString());
          } else if (editable) {
            handleInputValue(
              event.target.value,
              stateRef.current.originalElements,
              stateRef.current.originalAppState,
            );
          }
        }}
        disabled={!editable}
      />
    </div>
  );
};

export default StatsDragInput;

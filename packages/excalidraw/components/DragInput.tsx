import throttle from "lodash.throttle";
import { useEffect, useMemo, useRef } from "react";
import { EVENT } from "../constants";
import { getTransformHandles } from "../element";
import { mutateElement } from "../element/mutateElement";
import { resizeSingleElement } from "../element/resizeElements";
import type { ElementsMap, ExcalidrawElement } from "../element/types";
import { KEYS } from "../keys";
import { degreeToRadian, radianToDegree, rotatePoint } from "../math";
import Scene from "../scene/Scene";
import type { AppState, Point } from "../types";
import { arrayToMap } from "../utils";

const shouldKeepAspectRatio = (element: ExcalidrawElement) => {
  return element.type === "image";
};

type AdjustableProperty = "width" | "height" | "angle" | "x" | "y";

interface DragInputProps {
  label: string | React.ReactNode;
  property: AdjustableProperty;
  element: ExcalidrawElement;
  elementsMap: ElementsMap;
  zoom: AppState["zoom"];
}

const DragInput = ({
  label,
  property,
  element,
  elementsMap,
  zoom,
}: DragInputProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);

  const originalElementsMap = useMemo(
    () => arrayToMap(Scene.getScene(element)?.getNonDeletedElements() ?? []),
    [element],
  );

  const handleChange = useMemo(
    () =>
      (
        initialValue: number,
        delta: number,
        source: "pointerMove" | "keyDown",
        pointerOffset?: number,
      ) => {
        if (inputRef.current) {
          const keepAspectRatio = shouldKeepAspectRatio(element);

          if (
            (property === "width" || property === "height") &&
            source === "pointerMove" &&
            pointerOffset
          ) {
            const handles = getTransformHandles(
              element,
              zoom,
              elementsMap,
              "mouse",
            );

            let referencePoint: Point | undefined;
            let handleDirection: "e" | "s" | "se" | undefined;

            if (keepAspectRatio && handles.se) {
              referencePoint = [handles.se[0], handles.se[1]];
              handleDirection = "se";
            } else if (property === "width" && handles.e) {
              referencePoint = [handles.e[0], handles.e[1]];
              handleDirection = "e";
            } else if (property === "height" && handles.s) {
              referencePoint = [handles.s[0], handles.s[1]];
              handleDirection = "s";
            }

            if (referencePoint !== undefined && handleDirection !== undefined) {
              const pointerRotated = rotatePoint(
                [
                  referencePoint[0] +
                    (property === "width" ? pointerOffset : 0),
                  referencePoint[1] +
                    (property === "height" ? pointerOffset : 0),
                ],
                referencePoint,
                element.angle,
              );

              resizeSingleElement(
                originalElementsMap,
                keepAspectRatio,
                element,
                elementsMap,
                handleDirection,
                false,
                pointerRotated[0],
                pointerRotated[1],
              );
            }
          } else if (
            source === "keyDown" ||
            (source === "pointerMove" &&
              property !== "width" &&
              property !== "height")
          ) {
            const incVal = Math.round(
              Math.sign(delta) * Math.pow(Math.abs(delta) / 10, 1.6),
            );
            let newVal = initialValue + incVal;

            newVal =
              property === "angle"
                ? // so the degree converted from radian is an integer
                  degreeToRadian(
                    Math.round(
                      radianToDegree(
                        degreeToRadian(
                          Math.sign(newVal % 360) === -1
                            ? (newVal % 360) + 360
                            : newVal % 360,
                        ),
                      ),
                    ),
                  )
                : Math.round(newVal);

            mutateElement(element, {
              [property]: newVal,
            });
          }
        }
      },
    [element, property, zoom, elementsMap, originalElementsMap],
  );

  const hangleChangeThrottled = useMemo(() => {
    return throttle(handleChange, 16);
  }, [handleChange]);

  useEffect(() => {
    const value =
      Math.round(
        property === "angle"
          ? radianToDegree(element[property]) * 100
          : element[property] * 100,
      ) / 100;

    if (inputRef.current) {
      inputRef.current.value = String(value);
    }
  }, [element, element.version, element.versionNonce, property]);

  useEffect(() => {
    hangleChangeThrottled.cancel();
  });

  return (
    <label className="color-input-container">
      <div
        className="color-picker-hash"
        ref={labelRef}
        style={{
          width: "20px",
        }}
        onPointerDown={(event) => {
          if (inputRef.current) {
            const startPosition = event.clientX;
            let startValue = Number(inputRef.current.value);
            if (isNaN(startValue)) {
              startValue = 0;
            }

            let lastPointerRef: {
              x: number;
              y: number;
            } | null = null;

            document.body.classList.add("dragResize");

            const onPointerMove = (event: PointerEvent) => {
              if (lastPointerRef) {
                hangleChangeThrottled(
                  startValue,
                  Math.ceil(event.clientX - startPosition),
                  "pointerMove",
                  event.clientX - lastPointerRef.x,
                );
              }

              lastPointerRef = {
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

                lastPointerRef = null;

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
        className="color-picker-input"
        style={{
          width: "66px",
          fontSize: "12px",
        }}
        autoComplete="off"
        spellCheck="false"
        onKeyDown={(event) => {
          const eventTarget = event.target;

          if (eventTarget instanceof HTMLInputElement) {
            const value = Number(eventTarget.value);
            if (isNaN(value)) {
              return;
            }
            if (event.key === KEYS.ENTER) {
              handleChange(value, 0, "keyDown");
            }
          }
        }}
        ref={inputRef}
      ></input>
    </label>
  );
};

export default DragInput;

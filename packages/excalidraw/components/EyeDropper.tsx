import { useEffect, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";

import {
  EVENT,
  isColorDark,
  KEYS,
  MIME_TYPES,
  THEME,
  removeDarkModeFilter,
  rgbToHex,
} from "@excalidraw/common";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import { useUIAppState } from "../context/ui-appState";
import { atom } from "../editor-jotai";
import { useCreatePortalContainer } from "../hooks/useCreatePortalContainer";
import { useOutsideClick } from "../hooks/useOutsideClick";
import { useStable } from "../hooks/useStable";
import { getSelectedElements } from "../scene";

import { useApp, useExcalidrawContainer, useExcalidrawElements } from "./App";
import { eyeDropperIconSvgPaths } from "./icons";
import { positionElementBesideCursor } from "./positionElementBesideCursor";

import "./EyeDropper.scss";

import type { ColorPickerType } from "./ColorPicker/colorPickerUtils";

const eyeDropperCursorPaths = eyeDropperIconSvgPaths
  .map((path, idx) => `<path fill="${idx === 0 ? `#fff` : ``}" d="${path}" />`)
  .join("");
const eyeDropperCursor = `url(data:${MIME_TYPES.svg},${encodeURIComponent(
  `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke-linecap="round" stroke-linejoin="round"><g stroke="#fff" stroke-width="5">${eyeDropperCursorPaths}</g><g stroke="#1b1b1f" stroke-width="1.25">${eyeDropperCursorPaths}</g></svg>`,
)}) 2 21, auto`;

export type EyeDropperProperties = {
  keepOpenOnAlt: boolean;
  swapPreviewOnAlt?: boolean;
  /** called when user picks color (on pointerup) */
  onSelect: (color: string, event: PointerEvent) => void;
  /**
   * property of selected elements to update live when alt-dragging.
   * Supply `null` if not applicable (e.g. updating the canvas bg instead of
   * elements)
   **/
  colorPickerType: ColorPickerType;
};

export const activeEyeDropperAtom = atom<null | EyeDropperProperties>(null);

export const EyeDropper: React.FC<{
  onCancel: () => void;
  onSelect: EyeDropperProperties["onSelect"];
  /** called when color changes, on pointerdown for preview */
  onChange: (
    type: ColorPickerType,
    color: string,
    selectedElements: ExcalidrawElement[],
    event: { altKey: boolean },
  ) => void;
  colorPickerType: EyeDropperProperties["colorPickerType"];
}> = ({ onCancel, onChange, onSelect, colorPickerType }) => {
  const eyeDropperContainer = useCreatePortalContainer({
    className: "excalidraw-eye-dropper-backdrop",
    parentSelector: ".excalidraw-eye-dropper-container",
  });
  const appState = useUIAppState();
  const elements = useExcalidrawElements();
  const app = useApp();

  const selectedElements = getSelectedElements(elements, appState);

  const stableProps = useStable({
    app,
    onCancel,
    onChange,
    onSelect,
    selectedElements,
  });

  const { container: excalidrawContainer } = useExcalidrawContainer();

  useLayoutEffect(() => {
    if (!eyeDropperContainer) {
      return;
    }
    eyeDropperContainer.style.cursor = eyeDropperCursor;
    return () => {
      eyeDropperContainer.style.cursor = "";
    };
  }, [eyeDropperContainer]);

  useEffect(() => {
    const colorPreviewDiv = ref.current;

    if (!colorPreviewDiv || !app.canvas || !eyeDropperContainer) {
      return;
    }

    let isHoldingPointerDown = false;

    const ctx = app.canvas.getContext("2d")!;

    const getCurrentColor = ({
      clientX,
      clientY,
    }: {
      clientX: number;
      clientY: number;
    }) => {
      const pixel = ctx.getImageData(
        (clientX - appState.offsetLeft) * window.devicePixelRatio,
        (clientY - appState.offsetTop) * window.devicePixelRatio,
        1,
        1,
      ).data;

      return rgbToHex(pixel[0], pixel[1], pixel[2]);
    };

    const getColorToApply = (color: string) =>
      appState.theme === THEME.DARK ? removeDarkModeFilter(color) : color;

    const mouseMoveListener = ({
      clientX,
      clientY,
      altKey,
    }: {
      clientX: number;
      clientY: number;
      altKey: boolean;
    }) => {
      const { top, left } = positionElementBesideCursor({
        cursor: { x: clientX, y: clientY },
        element: {
          width: colorPreviewDiv.offsetWidth,
          height: colorPreviewDiv.offsetHeight,
        },
        container: eyeDropperContainer.getBoundingClientRect(),
        gap: 7,
      });

      colorPreviewDiv.style.top = `${top}px`;
      colorPreviewDiv.style.left = `${left}px`;

      const currentColor = getCurrentColor({ clientX, clientY });

      if (isHoldingPointerDown) {
        stableProps.onChange(
          colorPickerType,
          getColorToApply(currentColor),
          stableProps.selectedElements,
          { altKey },
        );
      }

      colorPreviewDiv.style.background = currentColor;
      colorPreviewDiv.style.setProperty(
        "--eye-dropper-preview-border-color",
        isColorDark(currentColor) ? "#fff" : "#222",
      );
    };

    const onCancel = () => {
      stableProps.onCancel();
    };

    const onSelect: Required<EyeDropperProperties>["onSelect"] = (
      color,
      event,
    ) => {
      stableProps.onSelect(color, event);
    };

    const pointerDownListener = (event: PointerEvent) => {
      isHoldingPointerDown = true;
      // NOTE we can't event.preventDefault() as that would stop
      // pointermove events
      event.stopImmediatePropagation();
    };

    const pointerUpListener = (event: PointerEvent) => {
      isHoldingPointerDown = false;

      // since we're not preventing default on pointerdown, the focus would
      // goes back to `body` so we want to refocus the editor container instead
      excalidrawContainer?.focus();

      event.stopImmediatePropagation();
      event.preventDefault();

      onSelect(getColorToApply(getCurrentColor(event)), event);
    };

    const keyDownListener = (event: KeyboardEvent) => {
      if (event.key === KEYS.ESCAPE) {
        event.preventDefault();
        event.stopImmediatePropagation();
        onCancel();
      }
    };

    // -------------------------------------------------------------------------

    eyeDropperContainer.tabIndex = -1;
    // focus container so we can listen on keydown events
    eyeDropperContainer.focus();

    // init color preview else it would show only after the first mouse move
    mouseMoveListener({
      clientX: stableProps.app.viewport.lastPosition.x,
      clientY: stableProps.app.viewport.lastPosition.y,
      altKey: false,
    });

    eyeDropperContainer.addEventListener(EVENT.KEYDOWN, keyDownListener);
    eyeDropperContainer.addEventListener(
      EVENT.POINTER_DOWN,
      pointerDownListener,
    );
    eyeDropperContainer.addEventListener(EVENT.POINTER_UP, pointerUpListener);
    window.addEventListener("pointermove", mouseMoveListener, {
      passive: true,
    });
    window.addEventListener(EVENT.BLUR, onCancel);

    return () => {
      isHoldingPointerDown = false;
      eyeDropperContainer.removeEventListener(EVENT.KEYDOWN, keyDownListener);
      eyeDropperContainer.removeEventListener(
        EVENT.POINTER_DOWN,
        pointerDownListener,
      );
      eyeDropperContainer.removeEventListener(
        EVENT.POINTER_UP,
        pointerUpListener,
      );
      window.removeEventListener("pointermove", mouseMoveListener);
      window.removeEventListener(EVENT.BLUR, onCancel);
    };
  }, [
    stableProps,
    app.canvas,
    eyeDropperContainer,
    colorPickerType,
    excalidrawContainer,
    appState.offsetLeft,
    appState.offsetTop,
    appState.theme,
  ]);

  const ref = useRef<HTMLDivElement>(null);

  useOutsideClick(
    ref,
    () => {
      onCancel();
    },
    (event) => {
      if (
        event.target.closest(
          ".excalidraw-eye-dropper-trigger, .excalidraw-eye-dropper-backdrop",
        )
      ) {
        return true;
      }
      // consider all other clicks as outside
      return false;
    },
  );

  if (!eyeDropperContainer) {
    return null;
  }

  return createPortal(
    <div ref={ref} className="excalidraw-eye-dropper-preview" />,
    eyeDropperContainer,
  );
};

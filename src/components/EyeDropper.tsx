import { atom } from "jotai";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { rgbToHex } from "../colors";
import { EVENT } from "../constants";
import { useUIAppState } from "../context/ui-appState";
import { mutateElement } from "../element/mutateElement";
import { useCreatePortalContainer } from "../hooks/useCreatePortalContainer";
import { useOutsideClick } from "../hooks/useOutsideClick";
import { KEYS } from "../keys";
import { getSelectedElements } from "../scene";
import Scene from "../scene/Scene";
import { ShapeCache } from "../scene/ShapeCache";
import { useApp, useExcalidrawContainer, useExcalidrawElements } from "./App";

import "./EyeDropper.scss";

type EyeDropperProperties = {
  keepOpenOnAlt: boolean;
  swapPreviewOnAlt?: boolean;
  onSelect: (color: string, event: PointerEvent) => void;
  previewType: "strokeColor" | "backgroundColor";
};

export const activeEyeDropperAtom = atom<null | EyeDropperProperties>(null);

export const EyeDropper: React.FC<{
  onCancel: () => void;
  onSelect: Required<EyeDropperProperties>["onSelect"];
  swapPreviewOnAlt?: EyeDropperProperties["swapPreviewOnAlt"];
  previewType: EyeDropperProperties["previewType"];
}> = ({ onCancel, onSelect, swapPreviewOnAlt, previewType }) => {
  const eyeDropperContainer = useCreatePortalContainer({
    className: "excalidraw-eye-dropper-backdrop",
    parentSelector: ".excalidraw-eye-dropper-container",
  });
  const appState = useUIAppState();
  const elements = useExcalidrawElements();
  const app = useApp();

  const selectedElements = getSelectedElements(elements, appState);

  const metaStuffRef = useRef({ selectedElements, app });
  metaStuffRef.current.selectedElements = selectedElements;
  metaStuffRef.current.app = app;

  const { container: excalidrawContainer } = useExcalidrawContainer();

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

    const mouseMoveListener = ({
      clientX,
      clientY,
      altKey,
    }: {
      clientX: number;
      clientY: number;
      altKey: boolean;
    }) => {
      // FIXME swap offset when the preview gets outside viewport
      colorPreviewDiv.style.top = `${clientY + 20}px`;
      colorPreviewDiv.style.left = `${clientX + 20}px`;

      const currentColor = getCurrentColor({ clientX, clientY });

      if (isHoldingPointerDown) {
        for (const element of metaStuffRef.current.selectedElements) {
          mutateElement(
            element,
            {
              [altKey && swapPreviewOnAlt
                ? previewType === "strokeColor"
                  ? "backgroundColor"
                  : "strokeColor"
                : previewType]: currentColor,
            },
            false,
          );
          ShapeCache.delete(element);
        }
        Scene.getScene(
          metaStuffRef.current.selectedElements[0],
        )?.informMutation();
      }

      colorPreviewDiv.style.background = currentColor;
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

      onSelect(getCurrentColor(event), event);
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
      clientX: metaStuffRef.current.app.lastViewportPosition.x,
      clientY: metaStuffRef.current.app.lastViewportPosition.y,
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
    app.canvas,
    eyeDropperContainer,
    onCancel,
    onSelect,
    swapPreviewOnAlt,
    previewType,
    excalidrawContainer,
    appState.offsetLeft,
    appState.offsetTop,
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

import { KEYS } from "../keys";
import {
  isWritableElement,
  getFontString,
  sceneCoordsToViewportCoords,
} from "../utils";
import Scene from "../scene/Scene";
import { isTextElement } from "../element/typeChecks";
import { CLASSES } from "../constants";
import { ExcalidrawElement, ExcalidrawTextElement } from "../element/types";
import { AppState } from "../types";
import React, { useCallback, useEffect, useRef, useState } from "react";

export const TextEditor = ({
  element,
  appState,
  canvas,
  onInitialization,
  onChange,
  onSubmit,
}: {
  element: ExcalidrawElement | null;
  appState: AppState;
  canvas: HTMLCanvasElement | null;
  onInitialization: (element: ExcalidrawTextElement) => void;
  onChange: (event: { element: ExcalidrawTextElement; text: string }) => void;
  onSubmit: (data: {
    element: ExcalidrawTextElement;
    text: string;
    viaKeyboard: boolean;
  }) => void;
}) => {
  useEffect(() => {
    if (isTextElement(element)) {
      onInitialization(element);
    }
  }, [element, onInitialization]);
  if (!isTextElement(element)) {
    return null;
  }
  return (
    <TextAreaEditor
      key={element.id}
      appState={appState}
      canvas={canvas}
      element={element}
      onChange={onChange}
      onSubmit={onSubmit}
    />
  );
};

const TextAreaEditor = ({
  element,
  appState,
  canvas,
  onChange,
  onSubmit,
}: {
  appState: AppState;
  element: ExcalidrawTextElement;
  canvas: HTMLCanvasElement | null;
  onChange: (event: { element: ExcalidrawTextElement; text: string }) => void;
  onSubmit: (data: {
    element: ExcalidrawTextElement;
    text: string;
    viaKeyboard: boolean;
  }) => void;
}) => {
  const [updatedElement, setUpdatedElement] = useState(element);
  const [ignoreBlur, setIgnoreBlur] = useState(true);

  const editable = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = useCallback(
    (viaKeyboard: boolean) => {
      if (ignoreBlur) {
        return;
      }
      onSubmit({
        element,
        // NOTE(srb): We changed this slightly, before it was giving the current
        // textarea value, now it's giving the "committed" textElement value
        // in practice it should not be possible to get this event before
        // the commit?
        text: normalizeText(editable.current!.value),
        viaKeyboard,
      });
    },
    [element, ignoreBlur, onSubmit],
  );

  const handleSubmitViaBlur = useCallback(() => {
    handleSubmit(false);
  }, [handleSubmit]);

  const handleSubmitViaKeyboard = () => {
    handleSubmit(true);
  };

  const bindBlurEvent = useCallback(() => {
    window.removeEventListener("pointerup", bindBlurEvent);
    // Deferred so that the pointerdown that initiates the wysiwyg doesn't
    // trigger the blur on ensuing pointerup.
    // Also to handle cases such as picking a color which would trigger a blur
    // in that same tick.
    setTimeout(() => {
      setIgnoreBlur(false);
      // case: clicking on the same property → no change → no update → no focus
      editable.current!.focus();
    });
  }, []);

  const updateElementFromScene = useCallback(() => {
    const maybeUpdatedElement = Scene.getScene(element)?.getElement(element.id);
    if (maybeUpdatedElement != null && isTextElement(maybeUpdatedElement)) {
      setUpdatedElement(maybeUpdatedElement);
    }
  }, [element]);

  // prevent blur when changing properties from the menu
  const onPointerDown = useCallback(
    (event: MouseEvent) => {
      if (
        (event.target instanceof HTMLElement ||
          event.target instanceof SVGElement) &&
        event.target.closest(`.${CLASSES.SHAPE_ACTIONS_MENU}`) &&
        !isWritableElement(event.target)
      ) {
        setIgnoreBlur(true);
        window.addEventListener("pointerup", bindBlurEvent);
        // handle edge-case where pointerup doesn't fire e.g. due to user
        // alt-tabbing away
        window.addEventListener("blur", handleSubmitViaBlur);
      }
    },
    [bindBlurEvent, handleSubmitViaBlur],
  );

  useEffect(() => {
    // select on init (focusing is done separately inside the bindBlurEvent()
    // because we need it to happen *after* the blur event from `pointerdown`)
    editable.current!.select();

    // NOTE(srb): Because this is in useEffect, and has setTimeout itself,
    // it's a bit more deferred than before
    bindBlurEvent();

    return () => {
      window.removeEventListener("pointerup", bindBlurEvent);
    };
  }, [bindBlurEvent]);

  useEffect(() => {
    // handle updates of textElement properties of editing element
    return Scene.getScene(element)!.addCallback(() => {
      updateElementFromScene();
      editable.current!.focus();
    });
  }, [element, updateElementFromScene]);

  useEffect(() => {
    return onWindowResize(canvas, updateElementFromScene);
  }, [canvas, updateElementFromScene]);

  useEffect(() => {
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [onPointerDown]);

  const stopEvent = useCallback((event: Event) => {
    event.preventDefault();
    event.stopPropagation();
  }, []);

  useEffect(() => {
    window.addEventListener("wheel", stopEvent, {
      passive: false,
      capture: true,
    });
    return () => {
      window.removeEventListener("wheel", stopEvent, true);
    };
  }, [stopEvent]);

  const [viewportX, viewportY] = getViewportCoords(
    appState,
    updatedElement.x,
    updatedElement.y,
  );
  const { textAlign, angle } = updatedElement;

  const lines = updatedElement.text.replace(/\r\n?/g, "\n").split("\n");
  const lineHeight = updatedElement.height / lines.length;
  const maxWidth =
    (appState.offsetLeft + appState.width - viewportX - 8) /
      appState.zoom.value -
    // margin-right of parent if any
    Number(
      getComputedStyle(
        document.querySelector(".excalidraw")!.parentNode as Element,
      ).marginRight.slice(0, -2),
    );

  return (
    <textarea
      ref={editable}
      dir="auto"
      tabIndex={0}
      data-type="wysiwyg"
      wrap="off"
      value={updatedElement.text}
      style={{
        position: "absolute",
        display: "inline-block",
        minHeight: "1em",
        backfaceVisibility: "hidden",
        margin: 0,
        padding: 0,
        border: 0,
        outline: 0,
        resize: "none",
        background: "transparent",
        overflow: "hidden",
        // prevent line wrapping (`whitespace: nowrap` doesn't work on FF)
        whiteSpace: "pre",
        // must be specified because in dark mode canvas creates a stacking context
        zIndex: "var(--zIndex-wysiwyg)" as any,
        font: getFontString(updatedElement),
        // must be defined *after* font ¯\_(ツ)_/¯
        lineHeight: `${lineHeight}px`,
        width: `${updatedElement.width}px`,
        height: `${updatedElement.height}px`,
        left: `${viewportX}px`,
        top: `${viewportY}px`,
        transform: getTransform(
          updatedElement.width,
          updatedElement.height,
          angle,
          appState,
          maxWidth,
        ),
        textAlign,
        color: updatedElement.strokeColor,
        opacity: updatedElement.opacity / 100,
        filter: "var(--theme-filter)",
        maxWidth: `${maxWidth}px`,
      }}
      onKeyDown={(event) => {
        if (event.key === KEYS.ESCAPE) {
          event.preventDefault();
          handleSubmitViaKeyboard();
        } else if (event.key === KEYS.ENTER && event[KEYS.CTRL_OR_CMD]) {
          event.preventDefault();
          if (event.nativeEvent.isComposing || event.keyCode === 229) {
            return;
          }
          handleSubmitViaKeyboard();
        } else if (event.key === KEYS.ENTER && !event.altKey) {
          event.stopPropagation();
        }
      }}
      onInput={(event: React.ChangeEvent<HTMLTextAreaElement>) => {
        onChange({
          element: updatedElement,
          text: normalizeText(event.target.value),
        });
      }}
      onBlur={handleSubmitViaBlur}
    />
  );
};

const onWindowResize = (
  canvas: HTMLCanvasElement | null,
  callback: () => void,
) => {
  // reposition wysiwyg in case of canvas is resized. Using ResizeObserver
  // is preferred so we catch changes from host, where window may not resize.
  let observer: ResizeObserver | null = null;
  if (canvas && "ResizeObserver" in window) {
    observer = new window.ResizeObserver(() => {
      callback();
    });
    observer.observe(canvas);
    return () => {
      observer?.disconnect();
    };
  }

  window.addEventListener("resize", callback);
  return () => {
    window.removeEventListener("resize", callback);
  };
};

const normalizeText = (text: string) => {
  return (
    text
      // replace tabs with spaces so they render and measure correctly
      .replace(/\t/g, "        ")
      // normalize newlines
      .replace(/\r?\n|\r/g, "\n")
  );
};

const getTransform = (
  width: number,
  height: number,
  angle: number,
  appState: AppState,
  maxWidth: number,
) => {
  const { zoom, offsetTop, offsetLeft } = appState;
  const degree = (180 * angle) / Math.PI;
  // offsets must be multiplied by 2 to account for the division by 2 of
  // the whole expression afterwards
  let translateX = ((width - offsetLeft * 2) * (zoom.value - 1)) / 2;
  const translateY = ((height - offsetTop * 2) * (zoom.value - 1)) / 2;
  if (width > maxWidth && zoom.value !== 1) {
    translateX = (maxWidth / 2) * (zoom.value - 1);
  }
  return `translate(${translateX}px, ${translateY}px) scale(${zoom.value}) rotate(${degree}deg)`;
};

const getViewportCoords = (appState: AppState, x: number, y: number) => {
  const { x: viewportX, y: viewportY } = sceneCoordsToViewportCoords(
    {
      sceneX: x,
      sceneY: y,
    },
    appState,
  );
  return [viewportX - appState.offsetLeft, viewportY - appState.offsetTop];
};

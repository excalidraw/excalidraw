import { KEYS } from "../keys";
import {
  isWritableElement,
  getFontString,
  sceneCoordsToViewportCoords,
} from "../utils";
import { isTextElement } from "../element/typeChecks";
import { CLASSES } from "../constants";
import { ExcalidrawElement, ExcalidrawTextElement } from "../element/types";
import { AppState } from "../types";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  BaseEditor,
  Descendant,
  createEditor,
  Node,
  Editor,
  Transforms,
} from "slate";
import { Slate, Editable, withReact, ReactEditor } from "slate-react";

type RootElement = { children: Text[] };
type Text = { text: string };

declare module "slate" {
  interface CustomTypes {
    Editor: BaseEditor & ReactEditor;
    Element: RootElement;
    Text: Text;
  }
}

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [element?.id, onInitialization]);
  if (!isTextElement(element)) {
    return null;
  }
  return (
    <SlateEditor
      key={element.id}
      appState={appState}
      canvas={canvas}
      element={element}
      onChange={onChange}
      onSubmit={onSubmit}
    />
  );
};

const SlateEditor = ({
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
  const [ignoreBlur, setIgnoreBlur] = useState(true);

  const editor = useMemo(() => withReact(createEditor()), []);

  const handleSubmit = useCallback(
    (viaKeyboard: boolean) => {
      onSubmit({
        element,
        text: normalizeText(slateModelToString(editor.children)),
        viaKeyboard,
      });
    },
    [element, onSubmit, editor],
  );

  const handleSubmitViaBlur = useCallback(() => {
    if (ignoreBlur) {
      return;
    }

    handleSubmit(false);
  }, [handleSubmit, ignoreBlur]);

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
      ReactEditor.focus(editor);
    });
  }, [editor]);

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
    Transforms.select(editor, []);

    // NOTE(srb): Because this is in useEffect, and has setTimeout itself,
    // it's a bit more deferred than before
    bindBlurEvent();

    return () => {
      window.removeEventListener("pointerup", bindBlurEvent);
    };
  }, [editor, bindBlurEvent]);

  useEffect(() => {
    ReactEditor.focus(editor);
  });

  useEffect(() => {
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [onPointerDown]);

  useEffect(() => {
    window.addEventListener("wheel", stopEvent, {
      passive: false,
      capture: true,
    });
    return () => {
      window.removeEventListener("wheel", stopEvent, true);
    };
  }, []);

  const [viewportX, viewportY] = getViewportCoords(
    appState,
    element.x,
    element.y,
  );
  const { textAlign, angle } = element;

  const lines = element.text.replace(/\r\n?/g, "\n").split("\n");
  const lineHeight = element.height / lines.length;
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
    <Slate
      editor={editor}
      value={stringToSlateModel(element.text)}
      onChange={(value) => {
        onChange({
          element,
          text: normalizeText(slateModelToString(value)),
        });
      }}
    >
      {/* There's a bug in Slate preventing onBlur from firing due to
       simultenous state.isUpdatingSelection */}
      <div onBlur={handleSubmitViaBlur}>
        <Editable
          dir="auto"
          tabIndex={0}
          data-type="wysiwyg"
          wrap="off"
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
            font: getFontString(element),
            // must be defined *after* font ¯\_(ツ)_/¯
            lineHeight: `${lineHeight}px`,
            width: `${element.width}px`,
            height: `${element.height}px`,
            left: `${viewportX}px`,
            top: `${viewportY}px`,
            transform: getTransform(
              element.width,
              element.height,
              angle,
              appState,
              maxWidth,
            ),
            textAlign,
            color: element.strokeColor,
            opacity: element.opacity / 100,
            filter: "var(--theme-filter)",
            maxWidth: `${maxWidth}px`,
          }}
          onDOMBeforeInput={(event) => {
            // Prevent the default "insert block on enter" Slate behavior,
            // so that we only need to deal with text elements. Insert a newline
            // character instead.
            switch (event.inputType) {
              case "insertLineBreak":
              case "insertParagraph":
                Editor.insertText(editor, "\n");
                event.preventDefault();
                break;
            }
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
        />
      </div>
    </Slate>
  );
};

const slateModelToString = (model: Descendant[]) => {
  return Node.string(model[0]);
};

const stringToSlateModel = (text: string) => {
  return [{ children: [{ text }] }];
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

const stopEvent = (event: Event) => {
  event.preventDefault();
  event.stopPropagation();
};

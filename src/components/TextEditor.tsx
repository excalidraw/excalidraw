import { KEYS } from "../keys";
import {
  isWritableElement,
  getFontString,
  sceneCoordsToViewportCoords,
} from "../utils";
import { isTextElement } from "../element/typeChecks";
import { CLASSES } from "../constants";
import {
  ExcalidrawElement,
  ExcalidrawTextElement,
  TextFormat,
} from "../element/types";
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
import {
  Slate,
  Editable,
  withReact,
  ReactEditor,
  RenderLeafProps,
} from "slate-react";
import { withHistory } from "slate-history";
import { ElementUpdate } from "../element/mutateElement";

type CursorFormat = Omit<TextFormat, "length">;
type SlateLineElement = { children: SlateTextElement[] };
type SlateTextElement = { text: string } & CursorFormat;

const FORMAT_PROPERTIES: { [Name in keyof CursorFormat]: true } = {
  opacity: true,
  strokeColor: true,
  textAlign: true,
};

type SlateEditor = BaseEditor & ReactEditor;

declare module "slate" {
  interface CustomTypes {
    Editor: SlateEditor;
    Element: SlateLineElement;
    Text: SlateTextElement;
  }
}

// We need to access the current `editor` from other places in the app, so
// we create a global map to get a reference to the editor state.
class TextEditors {
  private static elementToEditor = new Map<
    ExcalidrawTextElement["id"],
    SlateEditor
  >();

  static setEditorForElement(
    element: ExcalidrawTextElement,
    editor: SlateEditor,
  ) {
    this.elementToEditor.set(element.id, editor);
  }

  static removeEditorForElement(element: ExcalidrawTextElement) {
    this.elementToEditor.delete(element.id);
  }

  static getEditor(element: ExcalidrawTextElement): SlateEditor | null {
    return this.elementToEditor.get(element.id) ?? null;
  }
}

export const applyFormatInTextEditor = (
  element: ExcalidrawTextElement,
  updates: ElementUpdate<ExcalidrawTextElement>,
): void => {
  const editor = TextEditors.getEditor(element)!;

  // Perform the update on text tick, otherwise appState changes interfere
  // with the action
  setTimeout(() => {
    for (const key in updates) {
      const value = (updates as any)[key];
      if (typeof value !== "undefined") {
        // console.log("adding mark", key, value);
        // console.log(JSON.stringify(editor.selection, null, 2));

        Editor.addMark(editor, key, value);
      }
    }
  }, 1);
};

export const textFormatUpdates = <TElement extends ExcalidrawElement>(
  element: TElement,
  updates: ElementUpdate<TElement>,
): ElementUpdate<TElement> => {
  if (!isTextElement(element)) {
    return updates;
  }
  const relevantUpdates: Partial<CursorFormat> = {};
  for (const key in updates) {
    if (key in FORMAT_PROPERTIES) {
      // @ts-ignore
      relevantUpdates[key] = updates[key];
    }
  }
  return {
    ...updates,
    format: element.format.map((chunk) => ({ ...chunk, ...relevantUpdates })),
  };
};

export const TextEditor = ({
  element,
  appState,
  onInitialization,
  onChange,
  onSubmit,
}: {
  element: ExcalidrawElement | null;
  appState: AppState;
  onInitialization: (element: ExcalidrawTextElement) => void;
  onChange: (event: {
    element: ExcalidrawTextElement;
    updates: ElementUpdate<ExcalidrawTextElement>;
  }) => void;
  onSubmit: (data: {
    element: ExcalidrawTextElement;
    updates: ElementUpdate<ExcalidrawTextElement>;
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
    <SlateEditorWrapper
      key={element.id}
      appState={appState}
      element={element}
      onChange={onChange}
      onSubmit={onSubmit}
    />
  );
};

const SlateEditorWrapper = ({
  element,
  appState,
  onChange,
  onSubmit,
}: {
  appState: AppState;
  element: ExcalidrawTextElement;
  onChange: (event: {
    element: ExcalidrawTextElement;
    updates: ElementUpdate<ExcalidrawTextElement>;
  }) => void;
  onSubmit: (data: {
    element: ExcalidrawTextElement;
    updates: ElementUpdate<ExcalidrawTextElement>;
    viaKeyboard: boolean;
  }) => void;
}) => {
  const [ignoreBlur, setIgnoreBlur] = useState(true);

  const editor = useMemo(() => withHistory(withReact(createEditor())), []);

  useEffect(() => {
    TextEditors.setEditorForElement(element, editor);
    return () => {
      TextEditors.removeEditorForElement(element);
    };
  });

  const handleSubmit = useCallback(
    (viaKeyboard: boolean) => {
      onSubmit({
        element,
        updates: slateModelAndCursorToTextElement(
          editor.children,
          // We don't want to preserve cursor color after editing is done
          null,
        ),
        viaKeyboard,
      });
    },
    [element, onSubmit, editor],
  );

  const handleSubmitViaBlur = useCallback(() => {
    window.removeEventListener("blur", handleSubmitViaBlur);
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
  const [model, cursorFormat] = textElementToSlateModelAndCursor(element);

  return (
    <Slate
      editor={editor}
      // @ts-ignore: This works, but Slate's type definition doesn't expose it
      marks={cursorFormat}
      value={model}
      onChange={
        // setValue
        (model) => {
          const updates = slateModelAndCursorToTextElement(
            model,
            Editor.marks(editor),
          );
          // console.log(updates);

          if (hasVisibleUpdates(element, updates)) {
            onChange({ element, updates });
          }
        }
      }
    >
      {/* There's a bug in Slate preventing onBlur from firing due to
       simultenous state.isUpdatingSelection */}
      <div onBlur={handleSubmitViaBlur}>
        <Editable
          renderLeaf={renderSlateTextElement}
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
            opacity:
              element.format.length === 0 ? element.opacity / 100 : undefined,
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
        />
      </div>
    </Slate>
  );
};

const renderSlateTextElement = (props: RenderLeafProps) => {
  return (
    <span
      {...props.attributes}
      style={{
        color: props.leaf.strokeColor,
        opacity: props.leaf.opacity / 100,
      }}
    >
      {props.children}
    </span>
  );
};

const hasVisibleUpdates = (
  element: ExcalidrawTextElement,
  updates: ElementUpdate<ExcalidrawTextElement>,
) => {
  if (element.text.length !== updates.text?.length) {
    return true;
  }
  for (const [key, value] of Object.entries(updates)) {
    const doesMatchElement =
      key === "format"
        ? areSameFormats(updates.format!, element.format)
        : element[key as keyof ElementUpdate<ExcalidrawTextElement>] === value;
    if (!doesMatchElement) {
      return true;
    }
  }
  return false;
};

const areSameFormats = (a: TextFormat[], b: TextFormat[]) => {
  return (
    a.length === b.length &&
    a.every((formatA, i) => {
      const formatB = b[i];
      return (
        formatA.length === formatB.length && isSameFormat(formatA, formatB)
      );
    })
  );
};

const slateModelAndCursorToTextElement = (
  model: Descendant[],
  cursorFormat: CursorFormat | null,
) => {
  // console.log(X++, "model in", cursorFormat, model);
  const lines = model as SlateLineElement[];
  // console.log(lines);

  const firstFormat = cursorFormat ?? lines[0].children[0];
  const hasSingleFormat = lines.every((line) =>
    line.children.every((format) => isSameFormat(firstFormat, format)),
  );
  const format = hasSingleFormat
    ? []
    : lines.flatMap((line) =>
        line.children.map(({ text, ...format }) => ({
          ...format,
          length: text.length,
        })),
      );
  const text = normalizeText(lines.map((line) => Node.string(line)).join("\n"));
  // console.log(X++, "exc out", text, format);
  return { ...firstFormat, text, format };
};

// let X = 0;

const textElementToSlateModelAndCursor = (
  element: ExcalidrawTextElement,
): [Descendant[], CursorFormat | null] => {
  // console.log(X++, "exc in", element.text, element.format);

  // @ts-ignore
  const elementFormat: CursorFormat = {};
  Object.keys(FORMAT_PROPERTIES).forEach((key) => {
    // @ts-ignore
    elementFormat[key] = element[key];
  });
  const lines =
    element.format.length === 0
      ? element.text
          .split("\n")
          .map((line) => ({ children: [{ ...elementFormat, text: line }] }))
      : chunkText(element.format, element.text);
  // console.log(X++, "model out", lines, elementFormat);
  return [lines, elementFormat];
};

const isSameFormat = (a: CursorFormat, b: CursorFormat) => {
  return Object.keys(FORMAT_PROPERTIES).every(
    (property) =>
      a[property as keyof CursorFormat] === b[property as keyof CursorFormat],
  );
};

const chunkText = (formatChunks: TextFormat[], text: string) => {
  const lines = [];
  let chunks = [];
  let i = 0;
  for (const { length, ...format } of formatChunks) {
    const j = i + length;
    chunks.push({ ...format, text: text.slice(i, j) });
    i = j;
    if (text[i] === "\n") {
      i++;
      lines.push({ children: chunks });
      chunks = [];
    }
  }
  lines.push({ children: chunks });
  return lines;
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

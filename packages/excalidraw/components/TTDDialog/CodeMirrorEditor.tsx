import { useEffect, useRef } from "react";
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
  keymap,
  lineNumbers,
  placeholder as cmPlaceholder,
  drawSelection,
} from "@codemirror/view";
import {
  Compartment,
  EditorState,
  type Extension,
  type Range,
} from "@codemirror/state";
import {
  defaultKeymap,
  history,
  historyKeymap,
  redo,
} from "@codemirror/commands";
import { syntaxHighlighting, HighlightStyle } from "@codemirror/language";
import { tags } from "@lezer/highlight";

import type { Theme } from "@excalidraw/element/types";

import { mermaidLite } from "./mermaid-lang-lite";

export interface CodeMirrorEditorProps {
  value: string;
  onChange: (value: string) => void;
  onKeyboardSubmit?: () => void;
  placeholder?: string;
  theme: Theme;
  errorLine?: number | null;
}

// ---- Dark theme ----

const darkTheme = EditorView.theme(
  {
    "&": {
      backgroundColor: "#1e1e1e",
      color: "#d4d4d4",
    },
    ".cm-content": { caretColor: "#fff" },
    ".cm-cursor": { borderLeftColor: "#fff" },
    ".cm-selectionBackground": {
      backgroundColor: "rgba(86, 156, 214, 0.3)",
    },
    "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground":
      {
        backgroundColor: "rgba(86, 156, 214, 0.42)",
      },
    ".cm-gutters": {
      backgroundColor: "#1e1e1e",
      color: "#858585",
      border: "none",
    },
    ".cm-activeLineGutter": { backgroundColor: "#2a2a2a" },
    ".cm-activeLine": { backgroundColor: "#2a2a2a" },
    ".cm-errorLine": { backgroundColor: "rgba(255, 0, 0, 0.15)" },
    ".cm-selectedWordMatch": {
      backgroundColor: "rgba(255, 209, 102, 0.22)",
      borderRadius: "2px",
    },
  },
  { dark: true },
);

const darkHighlight = HighlightStyle.define([
  { tag: tags.keyword, color: "#569cd6" },
  { tag: tags.string, color: "#ce9178" },
  { tag: tags.comment, color: "#6a9955" },
  { tag: tags.number, color: "#b5cea8" },
  { tag: tags.operator, color: "#d4d4d4" },
  { tag: tags.punctuation, color: "#d4d4d4" },
  { tag: tags.variableName, color: "#9cdcfe" },
  { tag: tags.bracket, color: "#ffd700" },
]);

// ---- Light theme ----

const lightTheme = EditorView.theme({
  "&": {
    backgroundColor: "#ffffff",
    color: "#1e1e1e",
  },
  ".cm-content": { caretColor: "#000" },
  ".cm-cursor": { borderLeftColor: "#000" },
  ".cm-gutters": {
    backgroundColor: "#fff",
    color: "#999",
    border: "none",
  },
  ".cm-activeLineGutter": { backgroundColor: "#e8e8e8" },
  ".cm-activeLine": { backgroundColor: "#e8e8e8" },
  ".cm-errorLine": { backgroundColor: "rgba(255, 0, 0, 0.1)" },
  ".cm-selectedWordMatch": {
    backgroundColor: "rgba(255, 209, 102, 0.35)",
    borderRadius: "2px",
  },
});

const lightHighlight = HighlightStyle.define([
  { tag: tags.keyword, color: "#0000ff" },
  { tag: tags.string, color: "#a31515" },
  { tag: tags.comment, color: "#008000" },
  { tag: tags.number, color: "#098658" },
  { tag: tags.operator, color: "#1e1e1e" },
  { tag: tags.punctuation, color: "#1e1e1e" },
  { tag: tags.variableName, color: "#001080" },
  { tag: tags.bracket, color: "#af00db" },
]);

// ---- Error line decoration ----

const errorLineDeco = Decoration.line({ class: "cm-errorLine" });
const selectedWordMatchDeco = Decoration.mark({
  class: "cm-selectedWordMatch",
});

const getSelectedWordMatchText = (state: EditorState) => {
  const mainSelection = state.selection.main;
  if (state.selection.ranges.length !== 1 || mainSelection.empty) {
    return null;
  }

  const selectedWord = state.wordAt(mainSelection.from);
  if (
    !selectedWord ||
    selectedWord.from !== mainSelection.from ||
    selectedWord.to !== mainSelection.to
  ) {
    return null;
  }

  return state.sliceDoc(mainSelection.from, mainSelection.to);
};

const getSelectedWordMatchDecorations = (view: EditorView): DecorationSet => {
  const selectedWord = getSelectedWordMatchText(view.state);
  if (!selectedWord) {
    return Decoration.none;
  }

  const selection = view.state.selection.main;
  const ranges: Range<Decoration>[] = [];
  const doc = view.state.doc.toString();
  let searchFrom = 0;

  while (searchFrom <= doc.length - selectedWord.length) {
    const matchFrom = doc.indexOf(selectedWord, searchFrom);
    if (matchFrom === -1) {
      break;
    }

    const matchTo = matchFrom + selectedWord.length;
    const matchWord = view.state.wordAt(matchFrom);
    if (
      matchWord?.from === matchFrom &&
      matchWord.to === matchTo &&
      (matchFrom !== selection.from || matchTo !== selection.to)
    ) {
      ranges.push(selectedWordMatchDeco.range(matchFrom, matchTo));
    }

    searchFrom = matchTo;
  }

  return ranges.length ? Decoration.set(ranges) : Decoration.none;
};

const selectedWordMatchExtension = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = getSelectedWordMatchDecorations(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.selectionSet) {
        this.decorations = getSelectedWordMatchDecorations(update.view);
      }
    }
  },
  {
    decorations: (value) => value.decorations,
  },
);

const getErrorLineExtension = (
  errorLine: number | null | undefined,
  doc: { line(n: number): { from: number }; lines: number },
): Extension => {
  if (!errorLine || errorLine < 1 || errorLine > doc.lines) {
    return EditorView.decorations.of(Decoration.none);
  }
  const line = doc.line(errorLine);
  return EditorView.decorations.of(
    Decoration.set([errorLineDeco.range(line.from)]),
  );
};

// ---- Helpers ----

const getThemeExtensions = (theme: Theme) => {
  if (theme === "dark") {
    return [darkTheme, syntaxHighlighting(darkHighlight)];
  }
  return [lightTheme, syntaxHighlighting(lightHighlight)];
};

const CodeMirrorEditor = ({
  value,
  onChange,
  onKeyboardSubmit,
  placeholder,
  theme,
  errorLine,
}: CodeMirrorEditorProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const onKeyboardSubmitRef = useRef(onKeyboardSubmit);
  const themeCompartmentRef = useRef(new Compartment());
  const errorLineCompartmentRef = useRef(new Compartment());

  onChangeRef.current = onChange;
  onKeyboardSubmitRef.current = onKeyboardSubmit;

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const themeCompartment = themeCompartmentRef.current;

    const view = new EditorView({
      state: EditorState.create({
        doc: value,
        extensions: [
          keymap.of([
            {
              key: "Mod-Enter",
              run: () => {
                onKeyboardSubmitRef.current?.();
                return true;
              },
            },
            // historyKeymap binds Mod-Shift-z only on Mac; add it for all platforms
            { key: "Mod-Shift-z", run: redo, preventDefault: true },
          ]),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              onChangeRef.current(update.state.doc.toString());
            }
          }),
          history(),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          lineNumbers(),
          EditorView.lineWrapping,
          themeCompartment.of(getThemeExtensions(theme)),
          errorLineCompartmentRef.current.of([]),
          mermaidLite(),
          drawSelection({ drawRangeCursor: true }),
          selectedWordMatchExtension,
          ...(placeholder ? [cmPlaceholder(placeholder)] : []),
        ],
      }),
      parent: containerRef.current,
    });

    viewRef.current = view;
    view.focus();

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Swap theme dynamically via compartment
  useEffect(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }
    view.dispatch({
      effects: themeCompartmentRef.current.reconfigure(
        getThemeExtensions(theme),
      ),
    });
  }, [theme]);

  // Update error line highlight
  useEffect(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }
    view.dispatch({
      effects: errorLineCompartmentRef.current.reconfigure(
        getErrorLineExtension(errorLine, view.state.doc),
      ),
    });
  }, [errorLine]);

  // Sync external value changes into EditorView
  useEffect(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }
    const currentDoc = view.state.doc.toString();
    if (value !== currentDoc) {
      view.dispatch({
        changes: { from: 0, to: currentDoc.length, insert: value },
      });
    }
  }, [value]);

  return (
    <div
      ref={containerRef}
      className="ttd-dialog-input ttd-dialog-input--codemirror"
    />
  );
};

export default CodeMirrorEditor;

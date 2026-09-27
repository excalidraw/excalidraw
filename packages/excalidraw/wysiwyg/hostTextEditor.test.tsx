import { KEYS } from "@excalidraw/common";

import type { ExcalidrawTextElement } from "@excalidraw/element/types";

import { Excalidraw } from "../index";
import { API } from "../tests/helpers/api";
import { Pointer, UI } from "../tests/helpers/ui";
import { act, fireEvent, render, unmountComponent } from "../tests/test-utils";

import { setHostTextEditor } from "./hostTextEditor";

import type {
  HostTextEditor,
  HostTextEditorMountProps,
} from "./hostTextEditor";

unmountComponent();

const mouse = new Pointer("mouse");
const { h } = window;

/** A host editor: a contenteditable div inside the root, value kept aside. */
const createHostEditor = (shouldEdit = () => true) => {
  const state = {
    props: null as HostTextEditorMountProps | null,
    root: null as HTMLDivElement | null,
    field: null as HTMLDivElement | null,
    value: "",
    mount: vi.fn(),
    focus: vi.fn(),
    unmount: vi.fn(),
    layout: vi.fn(),
  };
  const editor: HostTextEditor = {
    shouldEdit,
    mount: (root, props) => {
      state.root = root;
      state.props = props;
      state.value = props.initialText;
      const field = document.createElement("div");
      field.contentEditable = "true";
      field.tabIndex = 0;
      root.appendChild(field);
      state.field = field;
      state.mount(root, props);
      return {
        getValue: () => state.value,
        focus: () => {
          state.focus();
          field.focus();
        },
        onLayout: state.layout,
        unmount: state.unmount,
      };
    },
  };
  const type = (value: string, options?: { lineHeight?: number }) => {
    state.value = value;
    act(() => state.props!.onChange(value, options));
  };
  return { editor, state, type };
};

const nextTask = () =>
  act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));

const textElement = () =>
  h.elements.find(
    (element): element is ExcalidrawTextElement => element.type === "text",
  )!;

describe("host text editor (sdamex F5)", () => {
  beforeEach(async () => {
    setHostTextEditor(null);
    await render(<Excalidraw handleKeyboardGlobally={true} />);
    API.setElements([]);
  });

  afterEach(() => {
    setHostTextEditor(null);
  });

  it("mounts into a root in place of the textarea, styled as the editor", async () => {
    const host = createHostEditor();
    setHostTextEditor(host.editor);
    UI.clickTool("text");
    mouse.clickAt(100, 100);

    expect(host.state.mount).toHaveBeenCalledTimes(1);
    const root = host.state.root!;
    expect(root.tagName).toBe("DIV");
    expect(root.dataset.type).toBe("wysiwyg");
    expect(root.classList.contains("excalidraw-wysiwyg")).toBe(true);
    expect(root.parentElement?.classList).toContain(
      "excalidraw-textEditorContainer",
    );
    expect(document.querySelector("textarea.excalidraw-wysiwyg")).toBeNull();
    expect(root.style.position).toBe("absolute");
    expect(root.style.lineHeight).toBe(String(textElement().lineHeight));
    expect(host.state.props!.initialText).toBe("");
    expect(host.state.props!.initialCaretClientPoint).toBeNull();
    expect(host.state.layout).toHaveBeenCalled();
  });

  it("onChange updates the element; lineHeight changes it first", async () => {
    const host = createHostEditor();
    setHostTextEditor(host.editor);
    UI.clickTool("text");
    mouse.clickAt(100, 100);

    host.type("a\tb");
    const before = textElement();
    expect(before.originalText).toBe("a        b");

    host.type("a b", { lineHeight: 2 });
    const after = textElement();
    expect(after.lineHeight).toBe(2);
    expect(after.height).toBeCloseTo(after.fontSize * 2);
    expect(after.height).toBeGreaterThan(before.height);
  });

  it("Escape inside the host editor submits the host value and unmounts once", async () => {
    const host = createHostEditor();
    setHostTextEditor(host.editor);
    UI.clickTool("text");
    mouse.clickAt(100, 100);
    host.type("hello");
    host.state.value = "hello world";

    fireEvent.keyDown(host.state.field!, { key: KEYS.ESCAPE });

    expect(h.state.editingTextElement).toBeNull();
    expect(textElement().originalText).toBe("hello world");
    expect(host.state.unmount).toHaveBeenCalledTimes(1);
    expect(host.state.root!.isConnected).toBe(false);
  });

  it("onBlur submits once blur submit is armed, as textarea onblur", async () => {
    const host = createHostEditor();
    setHostTextEditor(host.editor);
    UI.clickTool("text");
    mouse.clickAt(100, 100);
    host.type("x");

    await nextTask();
    expect(host.state.focus).toHaveBeenCalled();
    act(() => host.state.props!.onBlur());

    expect(h.state.editingTextElement).toBeNull();
    expect(textElement().originalText).toBe("x");
  });

  it("scene updates refocus the host editor only when focus left the root", async () => {
    const host = createHostEditor();
    setHostTextEditor(host.editor);
    UI.clickTool("text");
    mouse.clickAt(100, 100);
    await nextTask();

    host.state.field!.focus();
    host.state.focus.mockClear();
    act(() => h.app.scene.triggerUpdate());
    expect(host.state.focus).not.toHaveBeenCalled();

    host.state.field!.blur();
    act(() => h.app.scene.triggerUpdate());
    expect(host.state.focus).toHaveBeenCalledTimes(1);
  });

  it("the root focus() goes to the host editor (pickers refocus the text)", async () => {
    const host = createHostEditor();
    setHostTextEditor(host.editor);
    UI.clickTool("text");
    mouse.clickAt(100, 100);
    host.state.focus.mockClear();

    (document.querySelector(".excalidraw-wysiwyg") as HTMLElement).focus();
    expect(host.state.focus).toHaveBeenCalledTimes(1);
  });

  it("a text tool click on text passes the caret point", async () => {
    const text = API.createElement({
      type: "text",
      text: "ola",
      x: 60,
      y: 0,
      width: 100,
      height: 100,
    });
    API.setElements([text]);
    const host = createHostEditor();
    setHostTextEditor(host.editor);
    UI.clickTool("text");
    mouse.clickAt(text.x + 50, text.y + 50);

    expect(host.state.props!.initialText).toBe("ola");
    expect(host.state.props!.initialCaretClientPoint).toEqual({
      x: text.x + 50,
      y: text.y + 50,
    });
  });

  it("keys inside the host editor are not app shortcuts", async () => {
    const host = createHostEditor();
    setHostTextEditor(host.editor);
    UI.clickTool("text");
    mouse.clickAt(100, 100);

    // a shadow host of an inner field sits deeper than the root
    const inner = document.createElement("span");
    host.state.field!.appendChild(inner);
    fireEvent.keyDown(inner, { key: KEYS.R });

    expect(h.state.activeTool.type).not.toBe("rectangle");
    expect(h.state.editingTextElement).not.toBeNull();
  });

  it("shouldEdit false keeps the textarea", async () => {
    const host = createHostEditor(() => false);
    setHostTextEditor(host.editor);
    UI.clickTool("text");
    mouse.clickAt(100, 100);

    expect(host.state.mount).not.toHaveBeenCalled();
    expect(
      document.querySelector("textarea.excalidraw-wysiwyg"),
    ).not.toBeNull();
  });
});

describe("renderToolbarExtra (sdamex)", () => {
  it("renders host buttons in the toolbar before more tools", async () => {
    await render(
      <Excalidraw
        renderToolbarExtra={(isMobile) => (
          <button type="button" data-testid="host-tool">
            {isMobile ? "mobile" : "desktop"}
          </button>
        )}
      />,
    );
    const button = document.querySelector('[data-testid="host-tool"]')!;
    expect(button.textContent).toBe("desktop");
    const toolbar = button.closest(".App-toolbar")!;
    const extra = toolbar.querySelector(".App-toolbar__extra-tools-trigger")!;
    expect(
      button.compareDocumentPosition(extra) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});

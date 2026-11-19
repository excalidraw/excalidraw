import { newElementWith } from "@excalidraw/element";

import { CaptureUpdateAction } from "@excalidraw/element";

import type { ExcalidrawTextElement } from "@excalidraw/element/types";

import { reconcileElements } from "../data/reconcile";
import { Excalidraw } from "../index";
import { API } from "../tests/helpers/api";
import { Keyboard, Pointer, UI } from "../tests/helpers/ui";
import { getTextEditor, updateTextEditor } from "../tests/queries/dom";
import { act, fireEvent, render, unmountComponent } from "../tests/test-utils";

import type { RemoteExcalidrawElement } from "../data/reconcile";

const { h } = window;
const mouse = new Pointer("mouse");

const getText = (id: string) =>
  h.app.scene.getElement(id) as ExcalidrawTextElement;

describe("text editor & the world outside it", () => {
  let text: ExcalidrawTextElement;
  let editor: HTMLTextAreaElement;

  beforeEach(async () => {
    unmountComponent();
    await render(<Excalidraw handleKeyboardGlobally={true} />);
    text = API.createElement({ type: "text", text: "hello", x: 100, y: 100 });
    API.setElements([text]);
    mouse.doubleClickAt(text.x + 5, text.y + 5);
    editor = await getTextEditor();
    // the editor binds its blur handler (and takes focus) in a timeout
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(document.activeElement).toBe(editor);
  });

  it("keeps the edit when the window loses focus", () => {
    updateTextEditor(editor, "hello wor");
    // the window going away blurs the textarea, which stays the active element
    fireEvent.blur(editor);
    fireEvent.blur(window);
    expect(h.state.editingTextElement?.id).toBe(text.id);
    expect(document.querySelector("textarea")).toBe(editor);

    updateTextEditor(editor, "hello world");
    expect(getText(text.id).originalText).toBe("hello world");
  });

  it("submits when the focus moves elsewhere in the document", () => {
    updateTextEditor(editor, "hello world");
    act(() => editor.blur());
    expect(h.state.editingTextElement).toBeNull();
    expect(document.querySelector("textarea")).toBeNull();
    expect(getText(text.id).originalText).toBe("hello world");
  });

  it("takes a change of the text from outside, and edits go on from it", () => {
    updateTextEditor(editor, "hello wor");
    editor.setSelectionRange(2, 2);
    // the window goes away
    fireEvent.blur(editor);

    // another tab's sync: the scene replaced, the edit kept
    API.updateScene({
      elements: [
        newElementWith(getText(text.id), { originalText: "hello world, B" }),
      ],
      appState: { editingTextElement: h.state.editingTextElement },
      captureUpdate: CaptureUpdateAction.NEVER,
    });
    expect(editor.value).toBe("hello world, B");
    expect(editor.selectionStart).toBe(2);
    expect(h.state.editingTextElement?.id).toBe(text.id);

    updateTextEditor(editor, "hello world, B!");
    Keyboard.exitTextEditor(editor);
    expect(getText(text.id).originalText).toBe("hello world, B!");
    expect(getText(text.id).text).toBe("hello world, B!");

    // one undo entry, back to what the outside brought
    Keyboard.undo();
    expect(getText(text.id).originalText).toBe("hello world, B");
  });

  // When the editor shows a collaborator's edits of the text being edited,
  // as they come in:
  // - before the first keystroke, and while the window is away: yes
  // - from the first keystroke until the submit or the window going away:
  //   no, the text is the user's draft
  describe("a collaborator editing the same text", () => {
    /** a collaborator's keystroke, the way it reaches the scene in a room */
    const remoteEdit = (originalText: string) => {
      const remote = newElementWith(getText(text.id), {
        originalText,
        text: originalText,
      });
      API.updateScene({
        elements: reconcileElements(
          h.app.scene.getElementsIncludingDeleted(),
          [remote] as RemoteExcalidrawElement[],
          h.state,
        ),
        captureUpdate: CaptureUpdateAction.NEVER,
      });
      return remote;
    };

    it("shows their edits until the first keystroke", () => {
      remoteEdit("hello B");
      expect(editor.value).toBe("hello B");
      remoteEdit("hello BB");
      expect(editor.value).toBe("hello BB");
    });

    it("keeps the draft while typing, and the submit writes it on top", () => {
      updateTextEditor(editor, "hello A");
      const remote = remoteEdit("hello B");
      // the scene has their text, the editor the draft
      expect(getText(text.id).originalText).toBe("hello B");
      expect(editor.value).toBe("hello A");

      Keyboard.exitTextEditor(editor);
      expect(getText(text.id).originalText).toBe("hello A");
      // (newer than theirs: it wins on their client too)
      expect(getText(text.id).version).toBeGreaterThan(remote.version);
    });

    it("shows their edits while the window is away, until the next keystroke", () => {
      updateTextEditor(editor, "hello A");
      fireEvent.blur(editor);
      fireEvent.blur(window);

      remoteEdit("hello AB");
      expect(editor.value).toBe("hello AB");
      remoteEdit("hello ABB");
      expect(editor.value).toBe("hello ABB");

      // back, and typing on from their text
      fireEvent.focus(window);
      fireEvent.focus(editor);
      updateTextEditor(editor, "hello ABBA");
      remoteEdit("hello ABBB");
      expect(editor.value).toBe("hello ABBA");
    });
  });

  it("leaves the textarea alone on its own input and unrelated updates", () => {
    const values: string[] = [];
    const descriptor = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value",
    )!;
    Object.defineProperty(editor, "value", {
      get: () => descriptor.get!.call(editor),
      set: (value: string) => {
        values.push(value);
        descriptor.set!.call(editor, value);
      },
      configurable: true,
    });

    // own input (the helper's own write goes around this setter)
    updateTextEditor(editor, "hello\n    there");
    expect(values).toEqual([]);
    // an unrelated element changing (a collaborator's, say)
    const rect = API.createElement({ type: "rectangle", x: 500, y: 500 });
    API.updateScene({
      elements: [...h.elements, rect],
      captureUpdate: CaptureUpdateAction.NEVER,
    });
    API.updateScene({
      elements: h.elements.map((element) =>
        element.id === rect.id ? newElementWith(element, { x: 600 }) : element,
      ),
      captureUpdate: CaptureUpdateAction.NEVER,
    });
    expect(values).toEqual([]);
    expect(editor.value).toBe("hello\n    there");
  });

  it("closes when the element is deleted from outside, which stays deleted", async () => {
    updateTextEditor(editor, "hello wor");
    API.updateScene({
      elements: [newElementWith(getText(text.id), { isDeleted: true })],
      captureUpdate: CaptureUpdateAction.NEVER,
    });
    await act(async () => {});
    expect(document.querySelector("textarea")).toBeNull();
    expect(h.state.editingTextElement).toBeNull();
    expect(h.app.text.textWysiwygSubmitHandler).toBeNull();
    expect(getText(text.id).isDeleted).toBe(true);
  });

  it("closes when the element is removed from outside", async () => {
    API.updateScene({
      elements: [],
      captureUpdate: CaptureUpdateAction.NEVER,
    });
    await act(async () => {});
    expect(document.querySelector("textarea")).toBeNull();
    expect(h.state.editingTextElement).toBeNull();
    expect(h.app.text.textWysiwygSubmitHandler).toBeNull();
    expect(h.elements).toEqual([]);
  });

  it("stays open when the update that removed the element brings it back", async () => {
    updateTextEditor(editor, "draft");
    const restored = newElementWith(getText(text.id), {
      originalText: "restored",
      text: "restored",
    });
    // a host's reset followed by a load of the same scene
    act(() => {
      h.app.updateScene({
        elements: [],
        captureUpdate: CaptureUpdateAction.NEVER,
      });
      h.app.updateScene({
        elements: [restored],
        captureUpdate: CaptureUpdateAction.NEVER,
      });
    });
    await act(async () => {});
    // not closed, so nothing wrote the draft over the restored text
    expect(document.querySelector("textarea")).toBe(editor);
    expect(getText(text.id).originalText).toBe("restored");
  });

  it("is torn down with the app", async () => {
    Keyboard.exitTextEditor(editor);
    // a listener the editor opened next puts on the window
    const addEventListener = vi.spyOn(window, "addEventListener");
    mouse.doubleClickAt(text.x + 5, text.y + 5);
    await getTextEditor();
    const [, onBeforeUnload] = addEventListener.mock.calls.find(
      ([type]) => type === "beforeunload",
    )!;

    const removeEventListener = vi.spyOn(window, "removeEventListener");
    unmountComponent();
    expect(removeEventListener).toHaveBeenCalledWith(
      "beforeunload",
      onBeforeUnload,
    );
  });

  it("keeps a label's container in step with a change from outside", async () => {
    Keyboard.exitTextEditor(editor);
    const container = UI.createElement("rectangle", {
      x: 300,
      y: 300,
      width: 120,
      height: 60,
    });
    mouse.doubleClickAt(360, 330);
    editor = await getTextEditor();
    await new Promise((resolve) => setTimeout(resolve, 0));
    updateTextEditor(editor, "label");
    const label = h.elements.find(
      (element) => "containerId" in element && element.containerId,
    ) as ExcalidrawTextElement;
    expect(label.containerId).toBe(container.id);
    fireEvent.blur(editor);

    API.updateScene({
      elements: h.elements.map((element) =>
        element.id === label.id
          ? newElementWith(element as ExcalidrawTextElement, {
              originalText: "label from B",
              text: "label from B",
            })
          : element,
      ),
      captureUpdate: CaptureUpdateAction.NEVER,
    });
    expect(editor.value).toBe("label from B");
    updateTextEditor(editor, "label from B!");
    Keyboard.exitTextEditor(editor);
    expect(getText(label.id).originalText).toBe("label from B!");
    expect(
      h.app.scene.getElement(container.id)!.boundElements?.map(({ id }) => id),
    ).toEqual([label.id]);
    Keyboard.undo();
    Keyboard.redo();
    expect(getText(label.id).originalText).toBe("label from B!");
  });
});

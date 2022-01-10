import ReactDOM from "react-dom";
import ExcalidrawApp from "../excalidraw-app";
import { render, screen } from "../tests/test-utils";
import { Keyboard, Pointer, UI } from "../tests/helpers/ui";
import { KEYS } from "../keys";
import { fireEvent } from "../tests/test-utils";
import { BOUND_TEXT_PADDING, FONT_FAMILY } from "../constants";
import { ExcalidrawTextElementWithContainer } from "./types";
import * as textElementUtils from "./textElement";
// Unmount ReactDOM from root
ReactDOM.unmountComponentAtNode(document.getElementById("root")!);

const tab = "    ";
const mouse = new Pointer("mouse");

describe("textWysiwyg", () => {
  describe("Test unbounded text", () => {
    let textarea: HTMLTextAreaElement;
    beforeEach(async () => {
      await render(<ExcalidrawApp />);

      const element = UI.createElement("text");

      mouse.clickOn(element);
      textarea = document.querySelector(
        ".excalidraw-textEditorContainer > textarea",
      )!;
    });

    it("should add a tab at the start of the first line", () => {
      const event = new KeyboardEvent("keydown", { key: KEYS.TAB });
      textarea.value = "Line#1\nLine#2";
      // cursor: "|Line#1\nLine#2"
      textarea.selectionStart = 0;
      textarea.selectionEnd = 0;
      textarea.dispatchEvent(event);

      expect(textarea.value).toEqual(`${tab}Line#1\nLine#2`);
      // cursor: "    |Line#1\nLine#2"
      expect(textarea.selectionStart).toEqual(4);
      expect(textarea.selectionEnd).toEqual(4);
    });

    it("should add a tab at the start of the second line", () => {
      const event = new KeyboardEvent("keydown", { key: KEYS.TAB });
      textarea.value = "Line#1\nLine#2";
      // cursor: "Line#1\nLin|e#2"
      textarea.selectionStart = 10;
      textarea.selectionEnd = 10;

      textarea.dispatchEvent(event);

      expect(textarea.value).toEqual(`Line#1\n${tab}Line#2`);

      // cursor: "Line#1\n    Lin|e#2"
      expect(textarea.selectionStart).toEqual(14);
      expect(textarea.selectionEnd).toEqual(14);
    });

    it("should add a tab at the start of the first and second line", () => {
      const event = new KeyboardEvent("keydown", { key: KEYS.TAB });
      textarea.value = "Line#1\nLine#2\nLine#3";
      // cursor: "Li|ne#1\nLi|ne#2\nLine#3"
      textarea.selectionStart = 2;
      textarea.selectionEnd = 9;

      textarea.dispatchEvent(event);

      expect(textarea.value).toEqual(`${tab}Line#1\n${tab}Line#2\nLine#3`);

      // cursor: "    Li|ne#1\n    Li|ne#2\nLine#3"
      expect(textarea.selectionStart).toEqual(6);
      expect(textarea.selectionEnd).toEqual(17);
    });

    it("should remove a tab at the start of the first line", () => {
      const event = new KeyboardEvent("keydown", {
        key: KEYS.TAB,
        shiftKey: true,
      });
      textarea.value = `${tab}Line#1\nLine#2`;
      // cursor: "|    Line#1\nLine#2"
      textarea.selectionStart = 0;
      textarea.selectionEnd = 0;

      textarea.dispatchEvent(event);

      expect(textarea.value).toEqual(`Line#1\nLine#2`);

      // cursor: "|Line#1\nLine#2"
      expect(textarea.selectionStart).toEqual(0);
      expect(textarea.selectionEnd).toEqual(0);
    });

    it("should remove a tab at the start of the second line", () => {
      const event = new KeyboardEvent("keydown", {
        key: KEYS.TAB,
        shiftKey: true,
      });
      // cursor: "Line#1\n    Lin|e#2"
      textarea.value = `Line#1\n${tab}Line#2`;
      textarea.selectionStart = 15;
      textarea.selectionEnd = 15;

      textarea.dispatchEvent(event);

      expect(textarea.value).toEqual(`Line#1\nLine#2`);
      // cursor: "Line#1\nLin|e#2"
      expect(textarea.selectionStart).toEqual(11);
      expect(textarea.selectionEnd).toEqual(11);
    });

    it("should remove a tab at the start of the first and second line", () => {
      const event = new KeyboardEvent("keydown", {
        key: KEYS.TAB,
        shiftKey: true,
      });
      // cursor: "    Li|ne#1\n    Li|ne#2\nLine#3"
      textarea.value = `${tab}Line#1\n${tab}Line#2\nLine#3`;
      textarea.selectionStart = 6;
      textarea.selectionEnd = 17;

      textarea.dispatchEvent(event);

      expect(textarea.value).toEqual(`Line#1\nLine#2\nLine#3`);
      // cursor: "Li|ne#1\nLi|ne#2\nLine#3"
      expect(textarea.selectionStart).toEqual(2);
      expect(textarea.selectionEnd).toEqual(9);
    });

    it("should remove a tab at the start of the second line and cursor stay on this line", () => {
      const event = new KeyboardEvent("keydown", {
        key: KEYS.TAB,
        shiftKey: true,
      });
      // cursor: "Line#1\n  |  Line#2"
      textarea.value = `Line#1\n${tab}Line#2`;
      textarea.selectionStart = 9;
      textarea.selectionEnd = 9;
      textarea.dispatchEvent(event);

      // cursor: "Line#1\n|Line#2"
      expect(textarea.selectionStart).toEqual(7);
      // expect(textarea.selectionEnd).toEqual(7);
    });

    it("should remove partial tabs", () => {
      const event = new KeyboardEvent("keydown", {
        key: KEYS.TAB,
        shiftKey: true,
      });
      // cursor: "Line#1\n  Line#|2"
      textarea.value = `Line#1\n  Line#2`;
      textarea.selectionStart = 15;
      textarea.selectionEnd = 15;
      textarea.dispatchEvent(event);

      expect(textarea.value).toEqual(`Line#1\nLine#2`);
    });

    it("should remove nothing", () => {
      const event = new KeyboardEvent("keydown", {
        key: KEYS.TAB,
        shiftKey: true,
      });
      // cursor: "Line#1\n  Li|ne#2"
      textarea.value = `Line#1\nLine#2`;
      textarea.selectionStart = 9;
      textarea.selectionEnd = 9;
      textarea.dispatchEvent(event);

      expect(textarea.value).toEqual(`Line#1\nLine#2`);
    });
  });
  describe("Test bounded text", () => {
    let rectangle: any;
    const {
      h,
    }: {
      h: {
        elements: any;
      };
    } = window;

    const DUMMY_HEIGHT = 240;
    const DUMMY_WIDTH = 160;
    const DUMMY_SCROLL_HEIGHT = 25;
    const APPROX_LINE_HEIGHT = 25;
    const INITIAL_WIDTH = 10;

    beforeAll(() => {
      jest
        .spyOn(textElementUtils, "getApproxLineHeight")
        .mockReturnValue(APPROX_LINE_HEIGHT);
    });

    beforeEach(async () => {
      await render(<ExcalidrawApp />);

      rectangle = UI.createElement("rectangle", {
        x: 10,
        y: 20,
        width: 150,
        height: 100,
      });
    });

    it("should bind text to container when double clicked on center", async () => {
      expect(h.elements.length).toBe(1);
      expect(h.elements[0].id).toBe(rectangle.id);

      mouse.doubleClickAt(
        rectangle.x + rectangle.width / 2,
        rectangle.y + rectangle.height / 2,
      );
      expect(h.elements.length).toBe(2);

      const text = h.elements[1] as ExcalidrawTextElementWithContainer;
      expect(text.type).toBe("text");
      expect(text.containerId).toBe(rectangle.id);
      mouse.down();
      const editor = document.querySelector(
        ".excalidraw-textEditorContainer > textarea",
      ) as HTMLTextAreaElement;

      await new Promise((r) => setTimeout(r, 0));

      fireEvent.change(editor, { target: { value: "Hello World!" } });
      editor.blur();
      expect(rectangle.boundElements).toStrictEqual([
        { id: text.id, type: "text" },
      ]);
    });

    it("should bind text to container when clicked on container and enter pressed", async () => {
      expect(h.elements.length).toBe(1);
      expect(h.elements[0].id).toBe(rectangle.id);

      Keyboard.withModifierKeys({}, () => {
        Keyboard.keyPress(KEYS.ENTER);
      });

      expect(h.elements.length).toBe(2);

      const text = h.elements[1] as ExcalidrawTextElementWithContainer;
      expect(text.type).toBe("text");
      expect(text.containerId).toBe(rectangle.id);
      const editor = document.querySelector(
        ".excalidraw-textEditorContainer > textarea",
      ) as HTMLTextAreaElement;

      await new Promise((r) => setTimeout(r, 0));

      fireEvent.change(editor, { target: { value: "Hello World!" } });
      editor.blur();
      expect(rectangle.boundElements).toStrictEqual([
        { id: text.id, type: "text" },
      ]);
    });

    it("should update font family correctly on undo/redo by selecting bounded text when font family was updated", async () => {
      mouse.doubleClickAt(
        rectangle.x + rectangle.width / 2,
        rectangle.y + rectangle.height / 2,
      );
      mouse.down();

      const text = h.elements[1] as ExcalidrawTextElementWithContainer;
      let editor = document.querySelector(
        ".excalidraw-textEditorContainer > textarea",
      ) as HTMLTextAreaElement;

      await new Promise((r) => setTimeout(r, 0));
      fireEvent.change(editor, { target: { value: "Hello World!" } });
      editor.blur();
      expect(text.fontFamily).toEqual(FONT_FAMILY.Virgil);
      UI.clickTool("text");

      mouse.clickAt(
        rectangle.x + rectangle.width / 2,
        rectangle.y + rectangle.height / 2,
      );
      mouse.down();
      editor = document.querySelector(
        ".excalidraw-textEditorContainer > textarea",
      ) as HTMLTextAreaElement;

      editor.select();
      fireEvent.click(screen.getByTitle(/code/i));

      await new Promise((r) => setTimeout(r, 0));
      editor.blur();
      expect(h.elements[1].fontFamily).toEqual(FONT_FAMILY.Cascadia);

      //undo
      Keyboard.withModifierKeys({ ctrl: true }, () => {
        Keyboard.keyPress(KEYS.Z);
      });
      expect(h.elements[1].fontFamily).toEqual(FONT_FAMILY.Virgil);

      //redo
      Keyboard.withModifierKeys({ ctrl: true, shift: true }, () => {
        Keyboard.keyPress(KEYS.Z);
      });
      expect(h.elements[1].fontFamily).toEqual(FONT_FAMILY.Cascadia);
    });

    it.only("should vertcially center align once text submitted", async () => {
      jest
        .spyOn(textElementUtils, "measureText")
        .mockImplementation((text, font, maxWidth) => {
          let width = INITIAL_WIDTH;
          let height = APPROX_LINE_HEIGHT;
          let baseline = 10;
          if (!text) {
            return {
              width,
              height,
              baseline,
            };
          }
          baseline = 30;
          width = DUMMY_WIDTH;
          if (maxWidth) {
            width = maxWidth;
            // To capture cases where maxWidth passed is initial width
            // due to which the text is not wrapped correctly
            if (maxWidth === INITIAL_WIDTH) {
              height = DUMMY_HEIGHT;
            }
          }
          return {
            width,
            height,
            baseline,
          };
        });
      Keyboard.withModifierKeys({}, () => {
        Keyboard.keyPress(KEYS.ENTER);
      });

      let text = h.elements[1] as ExcalidrawTextElementWithContainer;
      const editor = document.querySelector(
        ".excalidraw-textEditorContainer > textarea",
      ) as HTMLTextAreaElement;
      // mock scroll height
      jest
        .spyOn(editor, "scrollHeight", "get")
        .mockImplementation(() => DUMMY_SCROLL_HEIGHT);

      fireEvent.change(editor, {
        target: {
          value: "Hello World!",
        },
      });
      editor.dispatchEvent(new Event("input"));

      await new Promise((r) => setTimeout(r, 0));
      editor.blur();
      text = h.elements[1] as ExcalidrawTextElementWithContainer;
      expect(text.y).toBe(
        rectangle.y + rectangle.height / 2 - APPROX_LINE_HEIGHT / 2,
      );
      expect(text.x).toBe(rectangle.x + BOUND_TEXT_PADDING);
      expect(text.height).toBe(DUMMY_SCROLL_HEIGHT);
      expect(text.width).toBe(rectangle.width - BOUND_TEXT_PADDING * 2);
    });
  });
});

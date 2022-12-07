import ReactDOM from "react-dom";
import ExcalidrawApp from "../excalidraw-app";
import { GlobalTestState, render, screen } from "../tests/test-utils";
import { Keyboard, Pointer, UI } from "../tests/helpers/ui";
import { CODES, KEYS } from "../keys";
import { fireEvent } from "../tests/test-utils";
import { queryByText } from "@testing-library/react";

import { BOUND_TEXT_PADDING, FONT_FAMILY } from "../constants";
import {
  ExcalidrawTextElement,
  ExcalidrawTextElementWithContainer,
} from "./types";
import * as textElementUtils from "./textElement";
import { API } from "../tests/helpers/api";
import { mutateElement } from "./mutateElement";
import { resize } from "../tests/utils";
// Unmount ReactDOM from root
ReactDOM.unmountComponentAtNode(document.getElementById("root")!);

const tab = "    ";
const mouse = new Pointer("mouse");

describe("textWysiwyg", () => {
  describe("start text editing", () => {
    const { h } = window;
    beforeEach(async () => {
      await render(<ExcalidrawApp />);
      h.elements = [];
    });

    it("should prefer editing selected text element (non-bindable container present)", async () => {
      const line = API.createElement({
        type: "line",
        width: 100,
        height: 0,
        points: [
          [0, 0],
          [100, 0],
        ],
      });
      const textSize = 20;
      const text = API.createElement({
        type: "text",
        text: "ola",
        x: line.width / 2 - textSize / 2,
        y: -textSize / 2,
        width: textSize,
        height: textSize,
      });
      h.elements = [text, line];

      API.setSelectedElements([text]);

      Keyboard.keyPress(KEYS.ENTER);

      expect(h.state.editingElement?.id).toBe(text.id);
      expect(
        (h.state.editingElement as ExcalidrawTextElement).containerId,
      ).toBe(null);
    });

    it("should prefer editing selected text element (bindable container present)", async () => {
      const container = API.createElement({
        type: "rectangle",
        width: 100,
        boundElements: [],
      });
      const textSize = 20;

      const boundText = API.createElement({
        type: "text",
        text: "ola",
        x: container.width / 2 - textSize / 2,
        y: container.height / 2 - textSize / 2,
        width: textSize,
        height: textSize,
        containerId: container.id,
      });

      const boundText2 = API.createElement({
        type: "text",
        text: "ola",
        x: container.width / 2 - textSize / 2,
        y: container.height / 2 - textSize / 2,
        width: textSize,
        height: textSize,
        containerId: container.id,
      });

      h.elements = [container, boundText, boundText2];

      mutateElement(container, {
        boundElements: [{ type: "text", id: boundText.id }],
      });

      API.setSelectedElements([boundText2]);

      Keyboard.keyPress(KEYS.ENTER);

      expect(h.state.editingElement?.id).toBe(boundText2.id);
    });

    it("should not create bound text on ENTER if text exists at container center", () => {
      const container = API.createElement({
        type: "rectangle",
        width: 100,
      });
      const textSize = 20;
      const text = API.createElement({
        type: "text",
        text: "ola",
        x: container.width / 2 - textSize / 2,
        y: container.height / 2 - textSize / 2,
        width: textSize,
        height: textSize,
        containerId: container.id,
      });
      mutateElement(container, {
        boundElements: [{ type: "text", id: text.id }],
      });

      h.elements = [container, text];

      API.setSelectedElements([container]);

      Keyboard.keyPress(KEYS.ENTER);

      expect(h.state.editingElement?.id).toBe(text.id);
    });

    it("should edit existing bound text on ENTER even if higher z-index unbound text exists at container center", () => {
      const container = API.createElement({
        type: "rectangle",
        width: 100,
        boundElements: [],
      });
      const textSize = 20;

      const boundText = API.createElement({
        type: "text",
        text: "ola",
        x: container.width / 2 - textSize / 2,
        y: container.height / 2 - textSize / 2,
        width: textSize,
        height: textSize,
        containerId: container.id,
      });

      const boundText2 = API.createElement({
        type: "text",
        text: "ola",
        x: container.width / 2 - textSize / 2,
        y: container.height / 2 - textSize / 2,
        width: textSize,
        height: textSize,
        containerId: container.id,
      });

      h.elements = [container, boundText, boundText2];

      mutateElement(container, {
        boundElements: [{ type: "text", id: boundText.id }],
      });

      API.setSelectedElements([container]);

      Keyboard.keyPress(KEYS.ENTER);

      expect(h.state.editingElement?.id).toBe(boundText.id);
    });

    it("should edit text under cursor when clicked with text tool", () => {
      const text = API.createElement({
        type: "text",
        text: "ola",
        x: 60,
        y: 0,
        width: 100,
        height: 100,
      });

      h.elements = [text];
      UI.clickTool("text");

      mouse.clickAt(text.x + 50, text.y + 50);

      const editor = document.querySelector(
        ".excalidraw-textEditorContainer > textarea",
      ) as HTMLTextAreaElement;

      expect(editor).not.toBe(null);
      expect(h.state.editingElement?.id).toBe(text.id);
      expect(h.elements.length).toBe(1);
    });

    it("should edit text under cursor when double-clicked with selection tool", () => {
      const text = API.createElement({
        type: "text",
        text: "ola",
        x: 60,
        y: 0,
        width: 100,
        height: 100,
      });

      h.elements = [text];
      UI.clickTool("selection");

      mouse.doubleClickAt(text.x + 50, text.y + 50);

      const editor = document.querySelector(
        ".excalidraw-textEditorContainer > textarea",
      ) as HTMLTextAreaElement;

      expect(editor).not.toBe(null);
      expect(h.state.editingElement?.id).toBe(text.id);
      expect(h.elements.length).toBe(1);
    });
  });

  describe("Test container-unbound text", () => {
    const { h } = window;

    let textarea: HTMLTextAreaElement;
    let textElement: ExcalidrawTextElement;
    beforeEach(async () => {
      await render(<ExcalidrawApp />);

      textElement = UI.createElement("text");

      mouse.clickOn(textElement);
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

    it("should resize text via shortcuts while in wysiwyg", () => {
      textarea.value = "abc def";
      const origFontSize = textElement.fontSize;
      textarea.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: KEYS.CHEVRON_RIGHT,
          ctrlKey: true,
          shiftKey: true,
        }),
      );
      expect(textElement.fontSize).toBe(origFontSize * 1.1);

      textarea.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: KEYS.CHEVRON_LEFT,
          ctrlKey: true,
          shiftKey: true,
        }),
      );
      expect(textElement.fontSize).toBe(origFontSize);
    });

    it("zooming via keyboard should zoom canvas", () => {
      expect(h.state.zoom.value).toBe(1);
      textarea.dispatchEvent(
        new KeyboardEvent("keydown", {
          code: CODES.MINUS,
          ctrlKey: true,
        }),
      );
      expect(h.state.zoom.value).toBe(0.9);
      textarea.dispatchEvent(
        new KeyboardEvent("keydown", {
          code: CODES.NUM_SUBTRACT,
          ctrlKey: true,
        }),
      );
      expect(h.state.zoom.value).toBe(0.8);
      textarea.dispatchEvent(
        new KeyboardEvent("keydown", {
          code: CODES.NUM_ADD,
          ctrlKey: true,
        }),
      );
      expect(h.state.zoom.value).toBe(0.9);
      textarea.dispatchEvent(
        new KeyboardEvent("keydown", {
          code: CODES.EQUAL,
          ctrlKey: true,
        }),
      );
      expect(h.state.zoom.value).toBe(1);
    });
  });

  describe("Test container-bound text", () => {
    let rectangle: any;
    const { h } = window;

    const DUMMY_HEIGHT = 240;
    const DUMMY_WIDTH = 160;
    const APPROX_LINE_HEIGHT = 25;
    const INITIAL_WIDTH = 10;

    beforeAll(() => {
      jest
        .spyOn(textElementUtils, "getApproxLineHeight")
        .mockReturnValue(APPROX_LINE_HEIGHT);
    });

    beforeEach(async () => {
      await render(<ExcalidrawApp />);
      h.elements = [];

      rectangle = UI.createElement("rectangle", {
        x: 10,
        y: 20,
        width: 90,
        height: 75,
      });
    });

    it("should bind text to container when double clicked on center of filled container", async () => {
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
      expect(rectangle.boundElements).toStrictEqual([
        { id: text.id, type: "text" },
      ]);
      mouse.down();
      const editor = document.querySelector(
        ".excalidraw-textEditorContainer > textarea",
      ) as HTMLTextAreaElement;

      fireEvent.change(editor, { target: { value: "Hello World!" } });

      await new Promise((r) => setTimeout(r, 0));
      editor.blur();
      expect(rectangle.boundElements).toStrictEqual([
        { id: text.id, type: "text" },
      ]);
    });

    it("should bind text to container when double clicked on center of transparent container", async () => {
      const rectangle = API.createElement({
        type: "rectangle",
        x: 10,
        y: 20,
        width: 90,
        height: 75,
        backgroundColor: "transparent",
      });
      h.elements = [rectangle];

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

      fireEvent.change(editor, { target: { value: "Hello World!" } });

      await new Promise((r) => setTimeout(r, 0));
      editor.blur();
      expect(rectangle.boundElements).toStrictEqual([
        { id: text.id, type: "text" },
      ]);
    });

    it("should bind text to container when clicked on container and enter pressed", async () => {
      expect(h.elements.length).toBe(1);
      expect(h.elements[0].id).toBe(rectangle.id);

      Keyboard.keyPress(KEYS.ENTER);

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

    it("shouldn't bind to non-text-bindable containers", async () => {
      const freedraw = API.createElement({
        type: "freedraw",
        width: 100,
        height: 0,
      });
      h.elements = [freedraw];

      UI.clickTool("text");

      mouse.clickAt(
        freedraw.x + freedraw.width / 2,
        freedraw.y + freedraw.height / 2,
      );

      const editor = document.querySelector(
        ".excalidraw-textEditorContainer > textarea",
      ) as HTMLTextAreaElement;

      fireEvent.change(editor, {
        target: {
          value: "Hello World!",
        },
      });
      fireEvent.keyDown(editor, { key: KEYS.ESCAPE });
      editor.dispatchEvent(new Event("input"));

      expect(freedraw.boundElements).toBe(null);
      expect(h.elements[1].type).toBe("text");
      expect((h.elements[1] as ExcalidrawTextElement).containerId).toBe(null);
    });

    ["freedraw", "line"].forEach((type: any) => {
      it(`shouldn't create text element when pressing 'Enter' key on ${type} `, async () => {
        h.elements = [];
        const elemnet = UI.createElement(type, {
          width: 100,
          height: 50,
        });
        API.setSelectedElements([elemnet]);
        Keyboard.keyPress(KEYS.ENTER);
        expect(h.elements.length).toBe(1);
      });
    });

    it("should'nt bind text to container when not double clicked on center", async () => {
      expect(h.elements.length).toBe(1);
      expect(h.elements[0].id).toBe(rectangle.id);

      // clicking somewhere on top left
      mouse.doubleClickAt(rectangle.x + 20, rectangle.y + 20);
      expect(h.elements.length).toBe(2);

      const text = h.elements[1] as ExcalidrawTextElementWithContainer;
      expect(text.type).toBe("text");
      expect(text.containerId).toBe(null);
      mouse.down();
      const editor = document.querySelector(
        ".excalidraw-textEditorContainer > textarea",
      ) as HTMLTextAreaElement;

      fireEvent.change(editor, { target: { value: "Hello World!" } });

      await new Promise((r) => setTimeout(r, 0));
      editor.blur();
      expect(rectangle.boundElements).toBe(null);
    });

    it("should update font family correctly on undo/redo by selecting bounded text when font family was updated", async () => {
      expect(h.elements.length).toBe(1);

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
      expect(
        (h.elements[1] as ExcalidrawTextElementWithContainer).fontFamily,
      ).toEqual(FONT_FAMILY.Cascadia);

      //undo
      Keyboard.withModifierKeys({ ctrl: true }, () => {
        Keyboard.keyPress(KEYS.Z);
      });
      expect(
        (h.elements[1] as ExcalidrawTextElementWithContainer).fontFamily,
      ).toEqual(FONT_FAMILY.Virgil);

      //redo
      Keyboard.withModifierKeys({ ctrl: true, shift: true }, () => {
        Keyboard.keyPress(KEYS.Z);
      });
      expect(
        (h.elements[1] as ExcalidrawTextElementWithContainer).fontFamily,
      ).toEqual(FONT_FAMILY.Cascadia);
    });

    it("should wrap text and vertcially center align once text submitted", async () => {
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
          if (text === "Hello \nWorld!") {
            height = APPROX_LINE_HEIGHT * 2;
          }
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

      expect(h.elements.length).toBe(1);

      Keyboard.keyDown(KEYS.ENTER);
      let text = h.elements[1] as ExcalidrawTextElementWithContainer;
      let editor = document.querySelector(
        ".excalidraw-textEditorContainer > textarea",
      ) as HTMLTextAreaElement;

      // mock scroll height
      jest
        .spyOn(editor, "scrollHeight", "get")
        .mockImplementation(() => APPROX_LINE_HEIGHT * 2);

      fireEvent.change(editor, {
        target: {
          value: "Hello World!",
        },
      });

      editor.dispatchEvent(new Event("input"));

      await new Promise((cb) => setTimeout(cb, 0));
      editor.blur();
      text = h.elements[1] as ExcalidrawTextElementWithContainer;
      expect(text.text).toBe("Hello \nWorld!");
      expect(text.originalText).toBe("Hello World!");
      expect(text.y).toBe(
        rectangle.y + rectangle.height / 2 - (APPROX_LINE_HEIGHT * 2) / 2,
      );
      expect(text.x).toBe(rectangle.x + BOUND_TEXT_PADDING);
      expect(text.height).toBe(APPROX_LINE_HEIGHT * 2);
      expect(text.width).toBe(rectangle.width - BOUND_TEXT_PADDING * 2);

      // Edit and text by removing second line and it should
      // still vertically align correctly
      mouse.select(rectangle);
      Keyboard.keyPress(KEYS.ENTER);

      editor = document.querySelector(
        ".excalidraw-textEditorContainer > textarea",
      ) as HTMLTextAreaElement;

      fireEvent.change(editor, {
        target: {
          value: "Hello",
        },
      });

      // mock scroll height
      jest
        .spyOn(editor, "scrollHeight", "get")
        .mockImplementation(() => APPROX_LINE_HEIGHT);
      editor.style.height = "25px";
      editor.dispatchEvent(new Event("input"));

      await new Promise((r) => setTimeout(r, 0));

      editor.blur();
      text = h.elements[1] as ExcalidrawTextElementWithContainer;

      expect(text.text).toBe("Hello");
      expect(text.originalText).toBe("Hello");
      expect(text.y).toBe(
        rectangle.y + rectangle.height / 2 - APPROX_LINE_HEIGHT / 2,
      );
      expect(text.x).toBe(rectangle.x + BOUND_TEXT_PADDING);
      expect(text.height).toBe(APPROX_LINE_HEIGHT);
      expect(text.width).toBe(rectangle.width - BOUND_TEXT_PADDING * 2);
    });

    it("should unbind bound text when unbind action from context menu is triggered", async () => {
      expect(h.elements.length).toBe(1);
      expect(h.elements[0].id).toBe(rectangle.id);

      Keyboard.keyPress(KEYS.ENTER);

      expect(h.elements.length).toBe(2);

      const text = h.elements[1] as ExcalidrawTextElementWithContainer;
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
      mouse.reset();
      UI.clickTool("selection");
      mouse.clickAt(10, 20);
      mouse.down();
      mouse.up();
      fireEvent.contextMenu(GlobalTestState.canvas, {
        button: 2,
        clientX: 20,
        clientY: 30,
      });
      const contextMenu = document.querySelector(".context-menu");
      fireEvent.click(queryByText(contextMenu as HTMLElement, "Unbind text")!);
      expect(h.elements[0].boundElements).toEqual([]);
      expect((h.elements[1] as ExcalidrawTextElement).containerId).toEqual(
        null,
      );
    });

    it("shouldn't bind to container if container has bound text", async () => {
      expect(h.elements.length).toBe(1);

      Keyboard.keyPress(KEYS.ENTER);

      expect(h.elements.length).toBe(2);

      // Bind first text
      const text = h.elements[1] as ExcalidrawTextElementWithContainer;
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

      mouse.select(rectangle);
      Keyboard.keyPress(KEYS.ENTER);
      expect(h.elements.length).toBe(2);

      expect(rectangle.boundElements).toStrictEqual([
        { id: h.elements[1].id, type: "text" },
      ]);
      expect(text.containerId).toBe(rectangle.id);
    });

    it("should respect text alignment when resizing", async () => {
      Keyboard.keyPress(KEYS.ENTER);

      let editor = document.querySelector(
        ".excalidraw-textEditorContainer > textarea",
      ) as HTMLTextAreaElement;
      await new Promise((r) => setTimeout(r, 0));
      fireEvent.change(editor, { target: { value: "Hello" } });
      editor.blur();

      // should center align horizontally and vertically by default
      resize(rectangle, "ne", [rectangle.x + 100, rectangle.y - 100]);
      expect([h.elements[1].x, h.elements[1].y]).toMatchInlineSnapshot(`
        Array [
          109.5,
          17,
        ]
      `);

      mouse.select(rectangle);
      Keyboard.keyPress(KEYS.ENTER);

      editor = document.querySelector(
        ".excalidraw-textEditorContainer > textarea",
      ) as HTMLTextAreaElement;

      editor.select();

      fireEvent.click(screen.getByTitle("Left"));
      fireEvent.click(screen.getByTitle("Align bottom"));
      await new Promise((r) => setTimeout(r, 0));

      editor.blur();

      // should left align horizontally and bottom vertically after resize
      resize(rectangle, "ne", [rectangle.x + 100, rectangle.y - 100]);
      expect([h.elements[1].x, h.elements[1].y]).toMatchInlineSnapshot(`
        Array [
          15,
          90,
        ]
      `);

      mouse.select(rectangle);
      Keyboard.keyPress(KEYS.ENTER);
      editor = document.querySelector(
        ".excalidraw-textEditorContainer > textarea",
      ) as HTMLTextAreaElement;

      editor.select();

      fireEvent.click(screen.getByTitle("Right"));
      fireEvent.click(screen.getByTitle("Align top"));

      await new Promise((r) => setTimeout(r, 0));

      editor.blur();

      // should right align horizontally and top vertically after resize
      resize(rectangle, "ne", [rectangle.x + 100, rectangle.y - 100]);
      expect([h.elements[1].x, h.elements[1].y]).toMatchInlineSnapshot(`
        Array [
          424,
          -539,
        ]
      `);
    });

    it("should always bind to selected container and insert it in correct position", async () => {
      const rectangle2 = UI.createElement("rectangle", {
        x: 5,
        y: 10,
        width: 120,
        height: 100,
      });

      API.setSelectedElements([rectangle]);
      Keyboard.keyPress(KEYS.ENTER);

      expect(h.elements.length).toBe(3);
      expect(h.elements[1].type).toBe("text");
      const text = h.elements[1] as ExcalidrawTextElementWithContainer;
      expect(text.type).toBe("text");
      expect(text.containerId).toBe(rectangle.id);
      mouse.down();
      const editor = document.querySelector(
        ".excalidraw-textEditorContainer > textarea",
      ) as HTMLTextAreaElement;

      fireEvent.change(editor, { target: { value: "Hello World!" } });

      await new Promise((r) => setTimeout(r, 0));
      editor.blur();
      expect(rectangle2.boundElements).toBeNull();
      expect(rectangle.boundElements).toStrictEqual([
        { id: text.id, type: "text" },
      ]);
    });

    it("should scale font size correctly when resizing using shift", async () => {
      Keyboard.keyPress(KEYS.ENTER);

      const editor = document.querySelector(
        ".excalidraw-textEditorContainer > textarea",
      ) as HTMLTextAreaElement;
      await new Promise((r) => setTimeout(r, 0));
      fireEvent.change(editor, { target: { value: "Hello" } });
      editor.blur();
      const textElement = h.elements[1] as ExcalidrawTextElement;
      expect(rectangle.width).toBe(90);
      expect(rectangle.height).toBe(75);
      expect(textElement.fontSize).toBe(20);

      resize(rectangle, "ne", [rectangle.x + 100, rectangle.y - 50], {
        shift: true,
      });
      expect(rectangle.width).toBe(200);
      expect(rectangle.height).toBe(166.66666666666669);
      expect(textElement.fontSize).toBe(47.5);
    });

    it("should bind text correctly when container duplicated with alt-drag", async () => {
      Keyboard.keyPress(KEYS.ENTER);

      const editor = document.querySelector(
        ".excalidraw-textEditorContainer > textarea",
      ) as HTMLTextAreaElement;
      await new Promise((r) => setTimeout(r, 0));
      fireEvent.change(editor, { target: { value: "Hello" } });
      editor.blur();
      expect(h.elements.length).toBe(2);

      mouse.select(rectangle);
      Keyboard.withModifierKeys({ alt: true }, () => {
        mouse.down(rectangle.x + 10, rectangle.y + 10);
        mouse.up(rectangle.x + 10, rectangle.y + 10);
      });
      expect(h.elements.length).toBe(4);
      const duplicatedRectangle = h.elements[0];
      const duplicatedText = h
        .elements[1] as ExcalidrawTextElementWithContainer;
      const originalRect = h.elements[2];
      const originalText = h.elements[3] as ExcalidrawTextElementWithContainer;
      expect(originalRect.boundElements).toStrictEqual([
        { id: originalText.id, type: "text" },
      ]);

      expect(originalText.containerId).toBe(originalRect.id);

      expect(duplicatedRectangle.boundElements).toStrictEqual([
        { id: duplicatedText.id, type: "text" },
      ]);

      expect(duplicatedText.containerId).toBe(duplicatedRectangle.id);
    });

    it("undo should work", async () => {
      Keyboard.keyPress(KEYS.ENTER);
      const editor = document.querySelector(
        ".excalidraw-textEditorContainer > textarea",
      ) as HTMLTextAreaElement;
      await new Promise((r) => setTimeout(r, 0));
      fireEvent.change(editor, { target: { value: "Hello" } });
      editor.blur();
      expect(rectangle.boundElements).toStrictEqual([
        { id: h.elements[1].id, type: "text" },
      ]);
      let text = h.elements[1] as ExcalidrawTextElementWithContainer;
      const originalRectX = rectangle.x;
      const originalRectY = rectangle.y;
      const originalTextX = text.x;
      const originalTextY = text.y;

      mouse.select(rectangle);
      mouse.downAt(rectangle.x, rectangle.y);
      mouse.moveTo(rectangle.x + 100, rectangle.y + 50);
      mouse.up(rectangle.x + 100, rectangle.y + 50);
      expect(rectangle.x).toBe(80);
      expect(rectangle.y).toBe(85);
      expect(text.x).toBe(89.5);
      expect(text.y).toBe(90);

      Keyboard.withModifierKeys({ ctrl: true }, () => {
        Keyboard.keyPress(KEYS.Z);
      });
      expect(rectangle.x).toBe(originalRectX);
      expect(rectangle.y).toBe(originalRectY);
      text = h.elements[1] as ExcalidrawTextElementWithContainer;
      expect(text.x).toBe(originalTextX);
      expect(text.y).toBe(originalTextY);
      expect(rectangle.boundElements).toStrictEqual([
        { id: text.id, type: "text" },
      ]);
      expect(text.containerId).toBe(rectangle.id);
    });

    it("should not allow bound text with only whitespaces", async () => {
      Keyboard.keyPress(KEYS.ENTER);
      const editor = document.querySelector(
        ".excalidraw-textEditorContainer > textarea",
      ) as HTMLTextAreaElement;
      await new Promise((r) => setTimeout(r, 0));

      fireEvent.change(editor, { target: { value: "   " } });
      editor.blur();
      expect(rectangle.boundElements).toStrictEqual([]);
      expect(h.elements[1].isDeleted).toBe(true);
    });
  });
});

import ReactDOM from "react-dom";
import ExcalidrawApp from "../excalidraw-app";
import { render } from "../tests/test-utils";
import { Pointer, UI } from "../tests/helpers/ui";
import { KEYS } from "../keys";

// Unmount ReactDOM from root
ReactDOM.unmountComponentAtNode(document.getElementById("root")!);

const tab = "    ";

describe("textWysiwyg", () => {
  let textarea: HTMLTextAreaElement;
  beforeEach(async () => {
    await render(<ExcalidrawApp />);

    const element = UI.createElement("text");

    new Pointer("mouse").clickOn(element);
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

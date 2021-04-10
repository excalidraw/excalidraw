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
    textarea.dispatchEvent(event);

    expect(textarea.value).toEqual(`${tab}Line#1\nLine#2`);
  });

  it("should add a tab at the start of the second line", () => {
    const event = new KeyboardEvent("keydown", { key: KEYS.TAB });
    textarea.value = "Line#1\nLine#2";
    // cursor: "Line#1\nLin|e#2"
    textarea.selectionStart = 10;

    textarea.dispatchEvent(event);

    expect(textarea.value).toEqual(`Line#1\n${tab}Line#2`);
  });

  it("should remove a tab at the start of the first line", () => {
    const event = new KeyboardEvent("keydown", {
      key: KEYS.TAB,
      shiftKey: true,
    });
    textarea.value = `${tab}Line#1\nLine#2`;
    // cursor: "|    Line#1\nLine#2"
    textarea.selectionStart = 0;
    textarea.dispatchEvent(event);

    expect(textarea.value).toEqual(`Line#1\nLine#2`);
  });

  it("should remove a tab at the start of the second line", () => {
    const event = new KeyboardEvent("keydown", {
      key: KEYS.TAB,
      shiftKey: true,
    });
    // cursor: "Line#1\n    Lin|e#2"
    textarea.value = `Line#1\n${tab}Line#2`;
    textarea.selectionStart = 15;
    textarea.dispatchEvent(event);

    expect(textarea.value).toEqual(`Line#1\nLine#2`);
  });

  it("should remove nothing", () => {
    const event = new KeyboardEvent("keydown", {
      key: KEYS.TAB,
      shiftKey: true,
    });
    // cursor: "Line#1\n  Lin|e#2"
    textarea.value = `Line#1\n  Line#2`;
    textarea.selectionStart = 15;
    textarea.dispatchEvent(event);

    expect(textarea.value).toEqual(`Line#1\n  Line#2`);
  });
});

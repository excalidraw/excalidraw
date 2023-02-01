import ReactDOM from "react-dom";
import { render, waitFor, GlobalTestState } from "./test-utils";
import { Pointer, Keyboard } from "./helpers/ui";
import ExcalidrawApp from "../excalidraw-app";
import { KEYS } from "../keys";
import { getApproxLineHeight } from "../element/textElement";
import { getFontString } from "../utils";
import { getElementBounds } from "../element";
import { NormalizedZoomValue } from "../types";

const { h } = window;

const mouse = new Pointer("mouse");

jest.mock("../keys.ts", () => {
  const actual = jest.requireActual("../keys.ts");
  return {
    __esmodule: true,
    ...actual,
    isDarwin: false,
    KEYS: {
      ...actual.KEYS,
      CTRL_OR_CMD: "ctrlKey",
    },
  };
});

const setClipboardText = (text: string) => {
  Object.assign(navigator, {
    clipboard: {
      readText: () => text,
    },
  });
};

const sendPasteEvent = () => {
  const clipboardEvent = new Event("paste", {
    bubbles: true,
    cancelable: true,
    composed: true,
  });

  // set `clipboardData` properties.
  // @ts-ignore
  clipboardEvent.clipboardData = {
    getData: () => window.navigator.clipboard.readText(),
    files: [],
  };

  document.dispatchEvent(clipboardEvent);
};

const pasteWithCtrlCmdShiftV = () => {
  Keyboard.withModifierKeys({ ctrl: true, shift: true }, () => {
    //triggering keydown with an empty clipboard
    Keyboard.keyPress(KEYS.V);
    //triggering paste event with faked clipboard
    sendPasteEvent();
  });
};

const pasteWithCtrlCmdV = () => {
  Keyboard.withModifierKeys({ ctrl: true }, () => {
    //triggering keydown with an empty clipboard
    Keyboard.keyPress(KEYS.V);
    //triggering paste event with faked clipboard
    sendPasteEvent();
  });
};

const sleep = (ms: number) => {
  return new Promise((resolve) => setTimeout(() => resolve(null), ms));
};

beforeEach(async () => {
  ReactDOM.unmountComponentAtNode(document.getElementById("root")!);

  localStorage.clear();

  mouse.reset();

  await render(<ExcalidrawApp />);
  h.app.setAppState({ zoom: { value: 1 as NormalizedZoomValue } });
  setClipboardText("");
  Object.assign(document, {
    elementFromPoint: () => GlobalTestState.canvas,
  });
});

describe("paste text as single lines", () => {
  it("should create an element for each line when copying with Ctrl/Cmd+V", async () => {
    const text = "sajgfakfn\naaksfnknas\nakefnkasf";
    setClipboardText(text);
    pasteWithCtrlCmdV();
    await waitFor(() => {
      expect(h.elements.length).toEqual(text.split("\n").length);
    });
  });

  it("should ignore empty lines when creating an element for each line", async () => {
    const text = "\n\nsajgfakfn\n\n\naaksfnknas\n\nakefnkasf\n\n\n";
    setClipboardText(text);
    pasteWithCtrlCmdV();
    await waitFor(() => {
      expect(h.elements.length).toEqual(3);
    });
  });

  it("should not create any element if clipboard has only new lines", async () => {
    const text = "\n\n\n\n\n";
    setClipboardText(text);
    pasteWithCtrlCmdV();
    await waitFor(async () => {
      await sleep(50); // elements lenght will always be zero if we don't wait, since paste is async
      expect(h.elements.length).toEqual(0);
    });
  });

  it("should space items correctly", async () => {
    const text = "hkhkjhki\njgkjhffjh\njgkjhffjh";
    const lineHeight =
      getApproxLineHeight(
        getFontString({
          fontSize: h.app.state.currentItemFontSize,
          fontFamily: h.app.state.currentItemFontFamily,
        }),
      ) +
      10 / h.app.state.zoom.value;
    mouse.moveTo(100, 100);
    setClipboardText(text);
    pasteWithCtrlCmdV();
    await waitFor(async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const [fx, firstElY] = getElementBounds(h.elements[0]);
      for (let i = 1; i < h.elements.length; i++) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const [fx, elY] = getElementBounds(h.elements[i]);
        expect(elY).toEqual(firstElY + lineHeight * i);
      }
    });
  });

  it("should leave a space for blank new lines", async () => {
    const text = "hkhkjhki\n\njgkjhffjh";
    const lineHeight =
      getApproxLineHeight(
        getFontString({
          fontSize: h.app.state.currentItemFontSize,
          fontFamily: h.app.state.currentItemFontFamily,
        }),
      ) +
      10 / h.app.state.zoom.value;
    mouse.moveTo(100, 100);
    setClipboardText(text);
    pasteWithCtrlCmdV();
    await waitFor(async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const [fx, firstElY] = getElementBounds(h.elements[0]);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const [lx, lastElY] = getElementBounds(h.elements[1]);
      expect(lastElY).toEqual(firstElY + lineHeight * 2);
    });
  });
});

describe("paste text as a single element", () => {
  it("should create single text element when copying text with Ctrl/Cmd+Shift+V", async () => {
    const text = "sajgfakfn\naaksfnknas\nakefnkasf";
    setClipboardText(text);
    pasteWithCtrlCmdShiftV();
    await waitFor(() => {
      expect(h.elements.length).toEqual(1);
    });
  });
  it("should not create any element when only new lines in clipboard", async () => {
    const text = "\n\n\n\n";
    setClipboardText(text);
    pasteWithCtrlCmdShiftV();
    await waitFor(async () => {
      await sleep(50);
      expect(h.elements.length).toEqual(0);
    });
  });
});

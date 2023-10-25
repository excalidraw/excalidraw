import { vi } from "vitest";
import ReactDOM from "react-dom";
import {
  render,
  waitFor,
  GlobalTestState,
  createPasteEvent,
} from "./test-utils";
import { Pointer, Keyboard } from "./helpers/ui";
import { Excalidraw } from "../packages/excalidraw/index";
import { KEYS } from "../keys";
import {
  getDefaultLineHeight,
  getLineHeightInPx,
} from "../element/textElement";
import { getElementBounds } from "../element";
import { NormalizedZoomValue } from "../types";
import { API } from "./helpers/api";
import { copyToClipboard } from "../clipboard";
import { copyText } from "../actions/actionClipboard";

const { h } = window;

const mouse = new Pointer("mouse");

vi.mock("../keys.ts", async (importOriginal) => {
  const module: any = await importOriginal();
  return {
    __esmodule: true,
    ...module,
    isDarwin: false,
    KEYS: {
      ...module.KEYS,
      CTRL_OR_CMD: "ctrlKey",
    },
  };
});

const sendPasteEvent = (text: string) => {
  const clipboardEvent = createPasteEvent({
    "text/plain": text,
  });
  document.dispatchEvent(clipboardEvent);
};

const pasteWithCtrlCmdShiftV = (text: string) => {
  Keyboard.withModifierKeys({ ctrl: true, shift: true }, () => {
    //triggering keydown with an empty clipboard
    Keyboard.keyPress(KEYS.V);
    //triggering paste event with faked clipboard
    sendPasteEvent(text);
  });
};

const pasteWithCtrlCmdV = (text: string) => {
  Keyboard.withModifierKeys({ ctrl: true }, () => {
    //triggering keydown with an empty clipboard
    Keyboard.keyPress(KEYS.V);
    //triggering paste event with faked clipboard
    sendPasteEvent(text);
  });
};

const sleep = (ms: number) => {
  return new Promise((resolve) => setTimeout(() => resolve(null), ms));
};

beforeEach(async () => {
  ReactDOM.unmountComponentAtNode(document.getElementById("root")!);

  localStorage.clear();

  mouse.reset();

  await render(
    <Excalidraw
      autoFocus={true}
      handleKeyboardGlobally={true}
      initialData={{ appState: { zoom: { value: 1 as NormalizedZoomValue } } }}
    />,
  );
  Object.assign(document, {
    elementFromPoint: () => GlobalTestState.canvas,
  });
});

describe("general paste behavior", () => {
  it("should randomize seed on paste", async () => {
    const rectangle = API.createElement({ type: "rectangle" });
    const clipboardJSON = (await copyToClipboard([rectangle], null))!;
    pasteWithCtrlCmdV(clipboardJSON);

    await waitFor(() => {
      expect(h.elements.length).toBe(1);
      expect(h.elements[0].seed).not.toBe(rectangle.seed);
    });
  });

  it("should retain seed on shift-paste", async () => {
    const rectangle = API.createElement({ type: "rectangle" });
    const clipboardJSON = (await copyToClipboard([rectangle], null))!;

    // assert we don't randomize seed on shift-paste
    pasteWithCtrlCmdShiftV(clipboardJSON);
    await waitFor(() => {
      expect(h.elements.length).toBe(1);
      expect(h.elements[0].seed).toBe(rectangle.seed);
    });
  });

  it("should follow left-to-right and top-to-bottom order when copying multiple text elements as text", async () => {
    const textElements = [
      {
        type: "text",
        version: 2,
        versionNonce: 987465201,
        isDeleted: false,
        id: "2EQMLORpeKfLXoU0ntr85",
        fillStyle: "hachure",
        strokeWidth: 1,
        strokeStyle: "solid",
        roughness: 1,
        opacity: 100,
        angle: 0,
        x: 490.74609375,
        y: 374.5078125,
        strokeColor: "#000000",
        backgroundColor: "transparent",
        width: 5.4199981689453125,
        height: 25,
        seed: 741725567,
        groupIds: [],
        roundness: null,
        boundElements: [],
        updated: 1684176615530,
        link: null,
        locked: false,
        fontSize: 20,
        fontFamily: 1,
        text: "1",
        textAlign: "left",
        verticalAlign: "top",
        containerId: null,
        originalText: "1",
        lineHeight: 1.25,
        baseline: 18,
      },
      {
        type: "text",
        version: 181,
        versionNonce: 742944031,
        isDeleted: false,
        id: "Xl4QbV2rr10dr0iMfHTKL",
        fillStyle: "hachure",
        strokeWidth: 1,
        strokeStyle: "solid",
        roughness: 1,
        opacity: 100,
        angle: 0,
        x: 548.72265625,
        y: 430.3984375,
        strokeColor: "#000000",
        backgroundColor: "transparent",
        width: 14.239990234375,
        height: 25,
        seed: 2117574609,
        groupIds: [],
        roundness: null,
        boundElements: [],
        updated: 1684176681040,
        link: null,
        locked: false,
        fontSize: 20,
        fontFamily: 1,
        text: "2",
        textAlign: "left",
        verticalAlign: "top",
        containerId: null,
        originalText: "2",
        lineHeight: 1.25,
        baseline: 18,
      },
      {
        type: "text",
        version: 130,
        versionNonce: 1222331231,
        isDeleted: false,
        id: "Qv09zmUxwJMS6Lrib3EEY",
        fillStyle: "hachure",
        strokeWidth: 1,
        strokeStyle: "solid",
        roughness: 1,
        opacity: 100,
        angle: 0,
        x: 545.98046875,
        y: 379.65234375,
        strokeColor: "#000000",
        backgroundColor: "transparent",
        width: 13.6199951171875,
        height: 25,
        seed: 2007970271,
        groupIds: [],
        roundness: null,
        boundElements: [],
        updated: 1684176675893,
        link: null,
        locked: false,
        fontSize: 20,
        fontFamily: 1,
        text: "3",
        textAlign: "left",
        verticalAlign: "top",
        containerId: null,
        originalText: "3",
        lineHeight: 1.25,
        baseline: 18,
      },
      {
        type: "text",
        version: 167,
        versionNonce: 1135947441,
        isDeleted: false,
        id: "cdzTjKWYbyXyTnPDFQDUd",
        fillStyle: "hachure",
        strokeWidth: 1,
        strokeStyle: "solid",
        roughness: 1,
        opacity: 100,
        angle: 0,
        x: 489.34375,
        y: 432.05078125,
        strokeColor: "#000000",
        backgroundColor: "transparent",
        width: 12.79998779296875,
        height: 25,
        seed: 1925481841,
        groupIds: [],
        roundness: null,
        boundElements: [],
        updated: 1684621613062,
        link: null,
        locked: false,
        fontSize: 20,
        fontFamily: 1,
        text: "4",
        textAlign: "left",
        verticalAlign: "top",
        containerId: null,
        originalText: "4",
        lineHeight: 1.25,
        baseline: 18,
      },
    ];
    const appState = {
      showWelcomeScreen: false,
      theme: "light",
      collaborators: {},
      currentChartType: "bar",
      currentItemBackgroundColor: "transparent",
      currentItemEndArrowhead: "arrow",
      currentItemFillStyle: "hachure",
      currentItemFontFamily: 1,
      currentItemFontSize: 20,
      currentItemOpacity: 100,
      currentItemRoughness: 1,
      currentItemStartArrowhead: null,
      currentItemStrokeColor: "#000000",
      currentItemRoundness: "round",
      currentItemStrokeStyle: "solid",
      currentItemStrokeWidth: 1,
      currentItemTextAlign: "left",
      cursorButton: "down",
      draggingElement: null,
      editingElement: null,
      editingGroupId: null,
      editingLinearElement: null,
      activeTool: {
        type: "selection",
        customType: null,
        locked: false,
        lastActiveTool: null,
      },
      penMode: false,
      penDetected: false,
      errorMessage: null,
      exportBackground: true,
      exportScale: 2,
      exportEmbedScene: false,
      exportWithDarkMode: false,
      fileHandle: null,
      gridSize: null,
      isBindingEnabled: true,
      defaultSidebarDockedPreference: false,
      isLoading: false,
      isResizing: false,
      isRotating: false,
      lastPointerDownWith: "mouse",
      multiElement: null,
      name: "Untitled-2023-05-13-1627",
      contextMenu: null,
      openMenu: null,
      openPopup: null,
      openSidebar: null,
      openDialog: null,
      pasteDialog: {
        shown: false,
        data: null,
      },
      previousSelectedElementIds: {
        goIijkoQM_TJZK8ydSkjH: true,
      },
      resizingElement: null,
      scrolledOutside: false,
      scrollX: 270.42857142857133,
      scrollY: 354.2857142857141,
      selectedElementIds: {
        "2EQMLORpeKfLXoU0ntr85": true,
        Xl4QbV2rr10dr0iMfHTKL: true,
        Qv09zmUxwJMS6Lrib3EEY: true,
        cdzTjKWYbyXyTnPDFQDUd: true,
        Oh9z_TJrnzC6VIIuZJsJZ: true,
      },
      selectedGroupIds: {},
      selectionElement: null,
      shouldCacheIgnoreZoom: false,
      showStats: false,
      startBoundElement: null,
      suggestedBindings: [],
      toast: null,
      viewBackgroundColor: "#ffffff",
      zenModeEnabled: false,
      zoom: {
        value: 0.7000000000000001,
      },
      viewModeEnabled: false,
      pendingImageElementId: null,
      showHyperlinkPopup: false,
      selectedLinearElement: null,
      offsetLeft: 0,
      offsetTop: 0,
      width: 1262,
      height: 944,
    };
    // @ts-ignore
    copyText.perform(textElements, appState);
    const text = await navigator.clipboard.readText();
    expect(text).toBe(`
    1

    3

    4

    2`);
  });
});

describe("paste text as single lines", () => {
  it("should create an element for each line when copying with Ctrl/Cmd+V", async () => {
    const text = "sajgfakfn\naaksfnknas\nakefnkasf";
    pasteWithCtrlCmdV(text);
    await waitFor(() => {
      expect(h.elements.length).toEqual(text.split("\n").length);
    });
  });

  it("should ignore empty lines when creating an element for each line", async () => {
    const text = "\n\nsajgfakfn\n\n\naaksfnknas\n\nakefnkasf\n\n\n";
    pasteWithCtrlCmdV(text);
    await waitFor(() => {
      expect(h.elements.length).toEqual(3);
    });
  });

  it("should not create any element if clipboard has only new lines", async () => {
    const text = "\n\n\n\n\n";
    pasteWithCtrlCmdV(text);
    await waitFor(async () => {
      await sleep(50); // elements lenght will always be zero if we don't wait, since paste is async
      expect(h.elements.length).toEqual(0);
    });
  });

  it("should space items correctly", async () => {
    const text = "hkhkjhki\njgkjhffjh\njgkjhffjh";
    const lineHeightPx =
      getLineHeightInPx(
        h.app.state.currentItemFontSize,
        getDefaultLineHeight(h.state.currentItemFontFamily),
      ) +
      10 / h.app.state.zoom.value;
    mouse.moveTo(100, 100);
    pasteWithCtrlCmdV(text);
    await waitFor(async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const [fx, firstElY] = getElementBounds(h.elements[0]);
      for (let i = 1; i < h.elements.length; i++) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const [fx, elY] = getElementBounds(h.elements[i]);
        expect(elY).toEqual(firstElY + lineHeightPx * i);
      }
    });
  });

  it("should leave a space for blank new lines", async () => {
    const text = "hkhkjhki\n\njgkjhffjh";
    const lineHeightPx =
      getLineHeightInPx(
        h.app.state.currentItemFontSize,
        getDefaultLineHeight(h.state.currentItemFontFamily),
      ) +
      10 / h.app.state.zoom.value;
    mouse.moveTo(100, 100);
    pasteWithCtrlCmdV(text);
    await waitFor(async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const [fx, firstElY] = getElementBounds(h.elements[0]);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const [lx, lastElY] = getElementBounds(h.elements[1]);
      expect(lastElY).toEqual(firstElY + lineHeightPx * 2);
    });
  });
});

describe("paste text as a single element", () => {
  it("should create single text element when copying text with Ctrl/Cmd+Shift+V", async () => {
    const text = "sajgfakfn\naaksfnknas\nakefnkasf";
    pasteWithCtrlCmdShiftV(text);
    await waitFor(() => {
      expect(h.elements.length).toEqual(1);
    });
  });
  it("should not create any element when only new lines in clipboard", async () => {
    const text = "\n\n\n\n";
    pasteWithCtrlCmdShiftV(text);
    await waitFor(async () => {
      await sleep(50);
      expect(h.elements.length).toEqual(0);
    });
  });
});

describe("Paste bound text container", () => {
  const container = {
    type: "ellipse",
    id: "container-id",
    x: 554.984375,
    y: 196.0234375,
    width: 166,
    height: 187.01953125,
    roundness: { type: 2 },
    boundElements: [{ type: "text", id: "text-id" }],
  };
  const textElement = {
    type: "text",
    id: "text-id",
    x: 560.51171875,
    y: 202.033203125,
    width: 154,
    height: 175,
    fontSize: 20,
    fontFamily: 1,
    text: "Excalidraw is a\nvirtual \nopensource \nwhiteboard for \nsketching \nhand-drawn like\ndiagrams",
    baseline: 168,
    textAlign: "center",
    verticalAlign: "middle",
    containerId: container.id,
    originalText:
      "Excalidraw is a virtual opensource whiteboard for sketching hand-drawn like diagrams",
  };

  it("should fix ellipse bounding box", async () => {
    const data = JSON.stringify({
      type: "excalidraw/clipboard",
      elements: [container, textElement],
    });
    pasteWithCtrlCmdShiftV(data);

    await waitFor(async () => {
      await sleep(1);
      expect(h.elements.length).toEqual(2);
      const container = h.elements[0];
      expect(container.height).toBe(368);
      expect(container.width).toBe(166);
    });
  });

  it("should fix diamond bounding box", async () => {
    const data = JSON.stringify({
      type: "excalidraw/clipboard",
      elements: [
        {
          ...container,
          type: "diamond",
        },
        textElement,
      ],
    });
    pasteWithCtrlCmdShiftV(data);

    await waitFor(async () => {
      await sleep(1);
      expect(h.elements.length).toEqual(2);
      const container = h.elements[0];
      expect(container.height).toBe(770);
      expect(container.width).toBe(166);
    });
  });
});

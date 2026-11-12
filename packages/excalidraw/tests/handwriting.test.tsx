import { getCommonBounds } from "@excalidraw/element";
import { pointFrom } from "@excalidraw/math";
import { KEYS } from "@excalidraw/common";

import { Excalidraw } from "../index";
import {
  getHandwritingLines,
  rasterizeHandwriting,
} from "../search/handwriting";
import { HandwritingRecognizer } from "../search/handwritingRecognizer";

import { API } from "./helpers/api";
import { Keyboard } from "./helpers/ui";
import { updateTextEditor } from "./queries/dom";
import { act, fireEvent, render, screen, waitFor } from "./test-utils";

const { h } = window;
const stroke = (x: number, y = 0) =>
  API.createElement({
    type: "freedraw",
    x,
    y,
    width: 10,
    height: 20,
    points: [pointFrom(0, 0), pointFrom(10, 20)],
  });

describe("handwriting line extraction", () => {
  it("joins nearby strokes but separates rows, distant notes and frames", () => {
    const a = stroke(0);
    const b = stroke(15);
    const c = stroke(0, 50);
    const d = stroke(400);
    const e = { ...stroke(16), frameId: "another-frame" };
    const lines = getHandwritingLines([a, b, c, d, e]);
    expect(lines).toHaveLength(4);
    expect(lines[0].elements).toEqual([a, b]);
    expect(lines[0].bounds).toEqual(getCommonBounds([a, b]));
  });

  it("ignores deleted and invisible strokes and typed text", () => {
    expect(
      getHandwritingLines([
        { ...stroke(0), isDeleted: true },
        { ...stroke(30), opacity: 0 },
        API.createElement({ type: "text", text: "hello" }),
      ]),
    ).toEqual([]);
  });

  it("invalidates only the changed line and ignores stacking order", () => {
    const a = stroke(0);
    const b = stroke(15);
    const c = stroke(400);
    const before = getHandwritingLines([a, b, c]);
    expect(getHandwritingLines([c, b, a]).map((line) => line.key)).toEqual(
      before.map((line) => line.key),
    );
    const after = getHandwritingLines([a, { ...b, version: b.version + 1 }, c]);
    expect(after[0].key).not.toBe(before[0].key);
    expect(after[1].key).toBe(before[1].key);
  });

  it("keeps the dot of a handwritten letter with its stem", () => {
    const stem = stroke(0);
    const dot: ReturnType<typeof stroke> = {
      ...stroke(5, -5),
      points: [pointFrom(0, 0)],
    };
    expect(getHandwritingLines([stem, dot])).toHaveLength(1);
  });

  it("bounds raster size for very large drawings", () => {
    const line = getHandwritingLines([
      {
        ...stroke(0),
        points: [pointFrom(0, 0), pointFrom(100000, 10000)],
      },
    ])[0];
    const image = rasterizeHandwriting(line, document);
    expect(image.width).toBeLessThanOrEqual(2048);
    expect(image.height).toBeLessThanOrEqual(120);
  });
});

describe("handwriting scene search", () => {
  const spyOnRecognize = () =>
    vi.spyOn(HandwritingRecognizer.prototype, "recognize");
  let recognize: ReturnType<typeof spyOnRecognize>;

  beforeEach(async () => {
    recognize = spyOnRecognize().mockResolvedValue("hello handwritten world");
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    await render(<Excalidraw handleKeyboardGlobally />);
  });

  afterEach(() => vi.restoreAllMocks());

  const openSearch = () => {
    Keyboard.withModifierKeys({ ctrl: true }, () => Keyboard.keyPress(KEYS.F));
    return screen.getByPlaceholderText(
      "Find text on canvas...",
    ) as HTMLInputElement;
  };

  it("combines handwriting and typed matches, caches queries and removes deleted handwriting", async () => {
    const a = stroke(0);
    const b = stroke(15);
    API.setElements([
      a,
      b,
      API.createElement({ type: "text", text: "hello typed world" }),
    ]);
    const input = openSearch();
    updateTextEditor(input, "hello");
    await waitFor(() => expect(h.state.searchMatches?.matches).toHaveLength(1));
    expect(recognize).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole("checkbox", {
        name: "Search handwriting (experimental)",
      }),
    );
    await waitFor(
      () => expect(h.state.searchMatches?.matches).toHaveLength(2),
      { timeout: 5000 },
    );
    const match = h.state.searchMatches!.matches[1];
    expect(match.id).toBe(a.id);
    expect(match.sceneBounds).toEqual(getCommonBounds([a, b]));
    expect(recognize).toHaveBeenCalledTimes(1);

    const setViewport = vi.spyOn(h.app.viewport, "setViewport");
    fireEvent.click(document.querySelectorAll(".layer-ui__result-item")[1]);
    expect(setViewport).toHaveBeenCalledWith(
      expect.objectContaining({
        target: getCommonBounds([a, b]),
      }),
    );

    updateTextEditor(input, "world");
    await waitFor(() => expect(h.state.searchMatches?.matches).toHaveLength(2));
    expect(recognize).toHaveBeenCalledTimes(1);

    API.setElements(
      h.elements.filter((element) => element.type !== "freedraw"),
    );
    await waitFor(() => expect(h.state.searchMatches?.matches).toHaveLength(1));
  });

  it("keeps typed search usable when recognition fails", async () => {
    recognize.mockRejectedValue(new Error("offline"));
    API.setElements([
      stroke(0),
      API.createElement({ type: "text", text: "hello" }),
    ]);
    const input = openSearch();
    fireEvent.click(
      screen.getByRole("checkbox", {
        name: "Search handwriting (experimental)",
      }),
    );
    updateTextEditor(input, "hello");
    await waitFor(
      () =>
        expect(screen.getByRole("status").textContent).toContain(
          "Could not recognize",
        ),
      { timeout: 5000 },
    );
    expect(h.state.searchMatches?.matches).toHaveLength(1);
  });

  it("recognizes only changed lines and reuses the cache after reopening search", async () => {
    API.setElements([stroke(0), stroke(400)]);
    const input = openSearch();
    updateTextEditor(input, "hello");
    const toggle = () =>
      fireEvent.click(
        screen.getByRole("checkbox", {
          name: "Search handwriting (experimental)",
        }),
      );
    toggle();
    await waitFor(
      () => expect(h.state.searchMatches?.matches).toHaveLength(2),
      { timeout: 5000 },
    );
    expect(recognize).toHaveBeenCalledTimes(2);
    API.updateElement(h.elements[0], { x: 5 });
    await waitFor(() => expect(recognize).toHaveBeenCalledTimes(3), {
      timeout: 5000,
    });
    await waitFor(
      () => expect(h.state.searchMatches?.matches).toHaveLength(2),
      { timeout: 5000 },
    );
    expect(recognize).toHaveBeenCalledTimes(3);

    Keyboard.keyPress(KEYS.ESCAPE, input);
    openSearch();
    toggle();
    await waitFor(
      () => expect(h.state.searchMatches?.matches).toHaveLength(2),
      { timeout: 5000 },
    );
    expect(recognize).toHaveBeenCalledTimes(3);
  });

  it("does not publish stale inference after handwriting is deleted", async () => {
    let resolve!: (text: string) => void;
    recognize.mockImplementation(
      () =>
        new Promise<string>((done) => {
          resolve = done;
        }),
    );
    API.setElements([stroke(0)]);
    const input = openSearch();
    updateTextEditor(input, "hello");
    fireEvent.click(
      screen.getByRole("checkbox", {
        name: "Search handwriting (experimental)",
      }),
    );
    await waitFor(() => expect(recognize).toHaveBeenCalledTimes(1), {
      timeout: 5000,
    });
    API.setElements([]);
    await act(async () => {
      resolve("hello");
    });
    await waitFor(() => expect(h.state.searchMatches).toBeNull());
    expect(screen.queryByText("hello handwritten world")).toBeNull();
  });
});

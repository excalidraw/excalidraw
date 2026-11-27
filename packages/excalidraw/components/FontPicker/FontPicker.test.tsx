import { fireEvent, screen, waitFor } from "@testing-library/react";
import React from "react";

import { FONT_FAMILY, KEYS } from "@excalidraw/common";
import {
  CaptureUpdateAction,
  Scene,
  updateStickyNoteLayout,
} from "@excalidraw/element";

import type { FontMetadata } from "@excalidraw/common";
import type {
  ExcalidrawElement,
  ExcalidrawTextElement,
} from "@excalidraw/element/types";

import { Excalidraw } from "../../index";
import { Fonts } from "../../fonts";
import { API } from "../../tests/helpers/api";
import { muteExpectedFontErrors } from "../../tests/helpers/mocks";
import { Keyboard, Pointer } from "../../tests/helpers/ui";
import { act, cleanup, render } from "../../tests/test-utils";

import type { FontResolver } from "../../fonts";
import type { ExcalidrawProps, FontProvider } from "../../types";

const metadata: FontMetadata = {
  metrics: {
    unitsPerEm: 1000,
    ascender: 800,
    descender: -200,
    lineHeight: 2,
  },
};

const fontFaces = [{ uri: "https://example.com/font.woff2" }] as const;

const createDeferredResolver = () => {
  let resolve!: (font: Awaited<ReturnType<FontResolver>>) => void;
  const resolver: FontResolver = vi.fn(
    () =>
      new Promise<Awaited<ReturnType<FontResolver>>>((resolvePromise) => {
        resolve = resolvePromise;
      }),
  );

  return {
    resolver,
    resolve: () => resolve({ fontFaces, metadata }),
  };
};

const mockVisibleIntersections = () => {
  const originalIntersectionObserver = global.IntersectionObserver;
  global.IntersectionObserver = class IntersectionObserver {
    constructor(private readonly callback: IntersectionObserverCallback) {}

    observe(target: Element) {
      this.callback(
        [{ isIntersecting: true, target } as IntersectionObserverEntry],
        this as unknown as globalThis.IntersectionObserver,
      );
    }

    unobserve() {}
    disconnect() {}
  } as unknown as typeof IntersectionObserver;

  return () => {
    global.IntersectionObserver = originalIntersectionObserver;
  };
};

const { h } = window;

describe("FontPicker", () => {
  let mutedConsoleError: ReturnType<typeof muteExpectedFontErrors>;

  afterEach(() => {
    cleanup();
    mutedConsoleError.mockRestore();
  });

  beforeEach(() => {
    // several tests below reject on purpose - keep the expected log out of the
    // test output
    mutedConsoleError = muteExpectedFontErrors();

    (global as any).ResizeObserver =
      (global as any).ResizeObserver ||
      class ResizeObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
      };
  });

  it("should be able to open font picker", async () => {
    const { queryByTestId } = await render(
      <Excalidraw handleKeyboardGlobally={true} />,
    );

    Keyboard.keyPress(KEYS.T);

    const fontPickerTrigger = queryByTestId("font-family-show-fonts");

    expect(fontPickerTrigger).not.toBeNull();

    act(() => {
      fontPickerTrigger!.click();
    });
  });

  it("only reacts to provider key changes, not resolver identity", async () => {
    // per the `FontProviders` contract a provider key always denotes the same
    // font source, so an inline (per-render) `fontProviders` object must not
    // churn the fonts instance or reload scene fonts
    const providers = (extraKey?: string) => ({
      "test.provider": {
        icon: <span />,
        resolve: vi.fn<FontResolver>(),
        availableFonts: [],
      },
      ...(extraKey
        ? {
            [extraKey]: {
              icon: <span />,
              resolve: vi.fn<FontResolver>(),
              availableFonts: [],
            },
          }
        : null),
    });

    const { rerender } = await render(
      <Excalidraw fontProviders={providers()} />,
    );
    const fonts = window.h.app.fonts.instance;

    // fresh object, same keys - contractually interchangeable
    rerender(<Excalidraw fontProviders={providers()} />);
    expect(window.h.app.fonts.instance).toBe(fonts);

    // an added key is the one realistic change - swap
    rerender(<Excalidraw fontProviders={providers("test.added")} />);
    await waitFor(() => expect(window.h.app.fonts.instance).not.toBe(fonts));
  });

  it("does not expose custom fonts cached by another editor", async () => {
    const fonts = new Fonts(new Scene(), {
      "test.hidden": vi.fn().mockResolvedValue({ fontFaces, metadata }),
    });
    await fonts.registerCustomFamily("test.hidden:Global");

    const { queryByTestId } = await render(
      <Excalidraw handleKeyboardGlobally={true} />,
    );
    Keyboard.keyPress(KEYS.T);
    fireEvent.click(queryByTestId("font-family-show-fonts")!);

    expect(screen.queryByText("Global")).toBeNull();
  });

  it("creates no IntersectionObserver without font providers", async () => {
    const constructed = vi.fn();
    const originalIntersectionObserver = global.IntersectionObserver;
    global.IntersectionObserver = class {
      constructor() {
        constructed();
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof IntersectionObserver;

    try {
      const { queryByTestId } = await render(
        <Excalidraw handleKeyboardGlobally={true} />,
      );
      Keyboard.keyPress(KEYS.T);
      fireEvent.click(queryByTestId("font-family-show-fonts")!);
      await screen.findByText("Excalifont");

      expect(constructed).not.toHaveBeenCalled();
    } finally {
      global.IntersectionObserver = originalIntersectionObserver;
    }
  });

  it("reverts a hover preview as a newer version, so collab syncs it", async () => {
    const { queryByTestId } = await render(<Excalidraw />);
    const [container, boundText] = API.createTextContainer();
    const text = boundText as ExcalidrawTextElement;
    API.setElements([container, text]);
    API.setSelectedElements([container]);
    const initialFontFamily = API.getElement(text).fontFamily;

    const trigger = queryByTestId("font-family-show-fonts")!;
    fireEvent.click(trigger);

    let textVersion = API.getElement(text).version;
    const containerVersion = API.getElement(container).version;
    for (const fontName of ["Nunito", "Comic Shanns"] as const) {
      fireEvent.mouseMove(
        (await screen.findByText(fontName)).closest("button")!,
      );
      await waitFor(() =>
        expect(API.getElement(text).fontFamily).toBe(FONT_FAMILY[fontName]),
      );
      expect(API.getElement(text).version).toBeGreaterThan(textVersion);
      textVersion = API.getElement(text).version;
    }

    fireEvent.click(trigger);

    await waitFor(() =>
      expect(API.getElement(text).fontFamily).toBe(initialFontFamily),
    );
    expect(API.getElement(text).version).toBeGreaterThan(textVersion);
    // the previews never changed its size, so there was nothing to restore
    expect(API.getElement(container).version).toBe(containerVersion);
  });

  it("leaves the elements alone when the picker closes without a preview", async () => {
    const { queryByTestId } = await render(<Excalidraw />);
    const text = API.createElement({ type: "text", text: "Hello" });
    API.setElements([text]);
    API.setSelectedElements([text]);

    const trigger = queryByTestId("font-family-show-fonts")!;
    fireEvent.click(trigger);
    await screen.findByText("Comic Shanns");

    // i.e. by a collaborator, while the picker is open
    API.updateElement(API.getElement(text) as ExcalidrawTextElement, {
      originalText: "Hello there",
      text: "Hello there",
      x: 100,
    });
    const { version } = API.getElement(text);

    fireEvent.click(trigger);
    await waitFor(() => expect(h.state.openPopup).toBe(null));

    expect(API.getElement(text)).toMatchObject({
      originalText: "Hello there",
      x: 100,
      version,
    });
  });

  it("takes a preview back to where it started, not to where the picker opened", async () => {
    const { queryByTestId } = await render(<Excalidraw />);
    const text = API.createElement({ type: "text", text: "Hello" });
    // selected along with the text, which is all it has to do with a font
    const rectangle = API.createElement({ type: "rectangle", x: 200 });
    API.setElements([text, rectangle]);
    API.setSelectedElements([text, rectangle]);
    const initialFontFamily = API.getElement(text).fontFamily;

    const trigger = queryByTestId("font-family-show-fonts")!;
    fireEvent.click(trigger);
    const comicShanns = (await screen.findByText("Comic Shanns")).closest(
      "button",
    )!;

    // i.e. by a collaborator, with the picker open and nothing hovered yet
    API.updateElement(API.getElement(text), { y: 300 });

    fireEvent.mouseMove(comicShanns);
    await waitFor(() =>
      expect(API.getElement(text).fontFamily).toBe(FONT_FAMILY["Comic Shanns"]),
    );

    // and during the preview
    API.updateElement(API.getElement(rectangle), { x: 350 });

    fireEvent.click(trigger);

    await waitFor(() =>
      expect(API.getElement(text).fontFamily).toBe(initialFontFamily),
    );
    expect(API.getElement(text).y).toBe(300);
    expect(API.getElement(rectangle).x).toBe(350);
  });

  it("restores the font size a preview refitted on a sticky note", async () => {
    const { queryByTestId } = await render(<Excalidraw />);
    const note = API.createElement({
      type: "stickynote",
      id: "note",
      width: 250,
      height: 250,
      baseHeight: 250,
      boundElements: [{ type: "text", id: "label" }],
    });
    const label = API.createElement({
      type: "text",
      id: "label",
      containerId: note.id,
      text: "one\ntwo\nthree\nfour\nfive\nsix\nseven",
      fontSize: 28,
      textAlign: "center",
      verticalAlign: "middle",
    });
    API.setElements([note, label]);
    act(() => {
      updateStickyNoteLayout(API.getElement(note), h.app.scene, {
        renderEnvironment: h.app.renderEnvironment,
      });
    });
    API.setSelectedElements([API.getElement(note)]);
    const { fontFamily, fontSize } = API.getElement(label);

    const trigger = queryByTestId("font-family-show-fonts")!;
    fireEvent.click(trigger);
    fireEvent.mouseMove(
      (await screen.findByText("Lilita One")).closest("button")!,
    );
    await waitFor(() =>
      expect(API.getElement(label).fontFamily).toBe(FONT_FAMILY["Lilita One"]),
    );
    expect(API.getElement(label).fontSize).not.toBe(fontSize);

    fireEvent.click(trigger);

    await waitFor(() =>
      expect(API.getElement(label).fontFamily).toBe(fontFamily),
    );
    expect(API.getElement(label).fontSize).toBe(fontSize);
  });

  it("lets a font be undone which was picked after a font repair landed on its preview", async () => {
    const { queryByTestId } = await render(
      <Excalidraw handleKeyboardGlobally={true} />,
    );
    const text = API.createElement({ type: "text", text: "Hello" });
    const other = API.createElement({ type: "text", text: "other", y: 200 });
    API.updateScene({
      elements: [text, other],
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
    API.setSelectedElements([text]);
    const initialFontFamily = API.getElement(text).fontFamily;
    const undoStackLength = API.getUndoStack().length;

    fireEvent.click(queryByTestId("font-family-show-fonts")!);
    const comicShanns = (await screen.findByText("Comic Shanns")).closest(
      "button",
    )!;
    fireEvent.mouseMove(comicShanns);
    await waitFor(() =>
      expect(API.getElement(text).fontFamily).toBe(FONT_FAMILY["Comic Shanns"]),
    );

    // Some font arrives during the hover, and text measured before it gets
    // repaired. Committed right away (never captured), the repair would take
    // the previewed font into the snapshot with it
    act(() => {
      h.app.fonts.instance.runSceneRepair(() => {
        h.app.scene.mutateElement(
          h.app.scene.getElement(other.id) as ExcalidrawTextElement,
          { lineHeight: 2 as ExcalidrawTextElement["lineHeight"] },
        );
      });
    });
    act(() => {
      h.app.scene.triggerUpdate();
    });
    expect(
      (API.getElement(other) as ExcalidrawTextElement).lineHeight,
    ).not.toBe(2);

    fireEvent.click(comicShanns);
    await waitFor(() => expect(h.state.openPopup).toBe(null));
    expect(API.getUndoStack().length).toBe(undoStackLength + 1);
    // the repair runs once the preview is over
    await waitFor(() =>
      expect((API.getElement(other) as ExcalidrawTextElement).lineHeight).toBe(
        2,
      ),
    );

    Keyboard.undo();
    expect(API.getElement(text).fontFamily).toBe(initialFontFamily);
  });

  it("takes back the font alone when the text was edited during the preview", async () => {
    const { queryByTestId } = await render(<Excalidraw />);
    const text = API.createElement({ type: "text", text: "Hello" });
    API.setElements([text]);
    API.setSelectedElements([text]);
    const initialFontFamily = API.getElement(text).fontFamily;

    const trigger = queryByTestId("font-family-show-fonts")!;
    fireEvent.click(trigger);
    fireEvent.mouseMove(
      (await screen.findByText("Comic Shanns")).closest("button")!,
    );
    await waitFor(() =>
      expect(API.getElement(text).fontFamily).toBe(FONT_FAMILY["Comic Shanns"]),
    );

    // i.e. by a collaborator
    API.updateElement(API.getElement(text) as ExcalidrawTextElement, {
      originalText: "Hello there",
      text: "Hello there",
      strokeColor: "#ff0000",
    });

    fireEvent.click(trigger);

    await waitFor(() =>
      expect(API.getElement(text).fontFamily).toBe(initialFontFamily),
    );
    expect(API.getElement(text)).toMatchObject({
      originalText: "Hello there",
      text: "Hello there",
      strokeColor: "#ff0000",
    });
  });

  it("reverts a hover preview when clicking outside the picker", async () => {
    const { queryByTestId } = await render(<Excalidraw />);
    const text = API.createElement({ type: "text", text: "Hello" });
    API.setElements([text]);
    API.setSelectedElements([text]);
    const initialFontFamily = API.getElement(text).fontFamily;

    fireEvent.click(queryByTestId("font-family-show-fonts")!);
    fireEvent.mouseMove(
      (await screen.findByText("Comic Shanns")).closest("button")!,
    );
    await waitFor(() =>
      expect(API.getElement(text).fontFamily).toBe(FONT_FAMILY["Comic Shanns"]),
    );

    // deselects, unmounting the panel
    new Pointer("mouse").clickAt(1000, 1000);

    await waitFor(() =>
      expect(API.getElement(text).fontFamily).toBe(initialFontFamily),
    );
    expect(h.state.currentHoveredFontFamily).toBeNull();
  });

  it("doesn't restore an element deleted during a hover preview", async () => {
    const { queryByTestId } = await render(<Excalidraw />);
    const text = API.createElement({ type: "text", text: "Hello" });
    API.setElements([text]);
    API.setSelectedElements([text]);

    fireEvent.click(queryByTestId("font-family-show-fonts")!);
    fireEvent.mouseMove(
      (await screen.findByText("Comic Shanns")).closest("button")!,
    );
    await waitFor(() =>
      expect(API.getElement(text).fontFamily).toBe(FONT_FAMILY["Comic Shanns"]),
    );

    // i.e. by a collaborator
    API.updateElement(API.getElement(text) as ExcalidrawTextElement, {
      isDeleted: true,
    });

    await waitFor(() => expect(h.state.currentHoveredFontFamily).toBeNull());
    expect(API.getElement(text).isDeleted).toBe(true);
  });

  it("reverts a hover preview after a close request which keeps the popup open", async () => {
    const { queryByTestId } = await render(<Excalidraw />);
    const text = API.createElement({ type: "text", text: "Hello" });
    API.setElements([text]);
    API.setSelectedElements([text]);
    const initialFontFamily = API.getElement(text).fontFamily;

    fireEvent.click(queryByTestId("font-family-show-fonts")!);
    const comicShanns = (await screen.findByText("Comic Shanns")).closest(
      "button",
    )!;

    // the focus moving out asks the popup to close, which it doesn't - as do
    // compact mode refocusing the text editor, and StrictMode
    act(() => {
      document.querySelector<HTMLElement>(".excalidraw-container")!.focus();
    });
    expect(h.state.openPopup).toBe("fontFamily");

    fireEvent.mouseMove(comicShanns);
    await waitFor(() =>
      expect(API.getElement(text).fontFamily).toBe(FONT_FAMILY["Comic Shanns"]),
    );

    // closed by the app, keeping the selection (and the panel)
    act(() => h.setState({ openPopup: null }));

    await waitFor(() =>
      expect(API.getElement(text).fontFamily).toBe(initialFontFamily),
    );
    expect(h.state.currentHoveredFontFamily).toBeNull();
  });

  it("closes on Escape, from the search too, taking a preview back", async () => {
    const { queryByTestId } = await render(<Excalidraw />);
    const text = API.createElement({ type: "text", text: "Hello" });
    API.setElements([text]);
    API.setSelectedElements([text]);
    const initialFontFamily = API.getElement(text).fontFamily;

    fireEvent.click(queryByTestId("font-family-show-fonts")!);
    fireEvent.mouseMove(
      (await screen.findByText("Comic Shanns")).closest("button")!,
    );
    await waitFor(() =>
      expect(API.getElement(text).fontFamily).toBe(FONT_FAMILY["Comic Shanns"]),
    );

    fireEvent.keyDown(
      document.querySelector(".properties-content .QuickSearch__input")!,
      { key: KEYS.ESCAPE },
    );

    await waitFor(() => expect(h.state.openPopup).toBe(null));
    expect(document.querySelector(".dropdown-menu.fonts")).toBe(null);
    await waitFor(() =>
      expect(API.getElement(text).fontFamily).toBe(initialFontFamily),
    );
    // the text is still selected - Escape went to the picker alone
    expect(h.state.selectedElementIds[text.id]).toBe(true);
  });

  it("lists a family by its preview text in place of the provider's icon", async () => {
    let resolvePreviewText!: (text: string) => void;
    const { queryByTestId } = await render(
      <Excalidraw
        handleKeyboardGlobally={true}
        fontProviders={{
          "test.provider": {
            icon: <span data-testid="provider-icon" />,
            resolve: createDeferredResolver().resolver,
            availableFonts: ["Latin Row", "Kana Row"],
            getPreviewText: (name) =>
              name === "Kana Row"
                ? new Promise((resolve) => (resolvePreviewText = resolve))
                : "",
          },
        }}
      />,
    );
    Keyboard.keyPress(KEYS.T);
    act(() => {
      queryByTestId("font-family-show-fonts")!.click();
    });

    const getIcon = async (label: string) =>
      (await screen.findByText(label))
        .closest("button")!
        .querySelector(".dropdown-menu-item__icon")!;
    const hasProviderIcon = (icon: Element) =>
      !!icon.querySelector('[data-testid="provider-icon"]');

    expect(hasProviderIcon(await getIcon("Kana Row"))).toBe(true);
    await act(async () => resolvePreviewText("あ"));

    const kanaIcon = await getIcon("Kana Row");
    expect(kanaIcon.textContent).toBe("あ");
    expect(hasProviderIcon(kanaIcon)).toBe(false);
    expect(hasProviderIcon(await getIcon("Latin Row"))).toBe(true);
  });

  it("lists a family by the icon our own fonts of its kind have", async () => {
    const { queryByTestId } = await render(
      <Excalidraw
        handleKeyboardGlobally={true}
        fontProviders={{
          "test.provider": {
            resolve: createDeferredResolver().resolver,
            availableFonts: ["Mono Row", "Plain Row"],
            getKind: (name) =>
              name === "Mono Row" ? Promise.resolve("code") : undefined,
          },
        }}
      />,
    );
    Keyboard.keyPress(KEYS.T);
    act(() => {
      queryByTestId("font-family-show-fonts")!.click();
    });

    // the icon's shape - its markup differs in the order of the attributes
    const getIcon = async (label: string) =>
      Array.from(
        (await screen.findByText(label))
          .closest("button")!
          .querySelectorAll(".dropdown-menu-item__icon path"),
        (path) => path.getAttribute("d"),
      ).join(" ");

    await waitFor(async () =>
      expect(await getIcon("Mono Row")).toBe(await getIcon("Comic Shanns")),
    );
    // no kind, and no icon of the provider's: a normal font's
    expect(await getIcon("Plain Row")).toBe(await getIcon("Nunito"));
    expect(await getIcon("Plain Row")).not.toBe(await getIcon("Mono Row"));
  });

  it("registers a visible available font before previewing it", async () => {
    const restoreIntersectionObserver = mockVisibleIntersections();
    const deferred = createDeferredResolver();
    try {
      const { queryByTestId } = await render(
        <Excalidraw
          fontProviders={{
            "test.provider": {
              icon: <span />,
              resolve: deferred.resolver,
              availableFonts: ["Kings"],
            },
          }}
        />,
      );
      const text = API.createElement({ type: "text", text: "preview" });
      API.setElements([text]);
      API.setSelectedElements([text]);
      const initialFontFamily = text.fontFamily;

      fireEvent.click(queryByTestId("font-family-show-fonts")!);
      const fontButton = (await screen.findByText("Kings")).closest("button")!;
      await waitFor(() => expect(deferred.resolver).toHaveBeenCalledTimes(1));
      fireEvent.mouseMove(fontButton);
      expect(API.getElement(text).fontFamily).toBe(initialFontFamily);

      await act(async () => deferred.resolve());
      fireEvent.mouseMove(
        (await screen.findByText("Kings")).closest("button")!,
      );
      await waitFor(() =>
        expect(API.getElement(text).fontFamily).toBe("test.provider:Kings"),
      );
    } finally {
      restoreIntersectionObserver();
    }
  });

  it("shows the retry state when registering a visible font fails", async () => {
    const restoreIntersectionObserver = mockVisibleIntersections();
    const resolve = vi.fn().mockRejectedValue(new Error("failed"));
    try {
      const { queryByTestId } = await render(
        <Excalidraw
          handleKeyboardGlobally={true}
          fontProviders={{
            "test.provider": {
              icon: <span />,
              resolve,
              availableFonts: ["BrokenVisible"],
            },
          }}
        />,
      );

      Keyboard.keyPress(KEYS.T);
      fireEvent.click(queryByTestId("font-family-show-fonts")!);
      await screen.findByText("BrokenVisible");

      await waitFor(() => expect(resolve).toHaveBeenCalledTimes(1));
      await waitFor(() =>
        expect(screen.getByText("BrokenVisible").closest("button")).toHaveClass(
          "FontPicker__font--failed",
        ),
      );
      expect(
        screen
          .getByText("BrokenVisible")
          .closest("button")
          ?.querySelector(".FontPicker__retry-icon"),
      ).not.toBeNull();
    } finally {
      restoreIntersectionObserver();
    }
  });

  it("ignores a resolution after the search query changes", async () => {
    const deferred = createDeferredResolver();
    const { queryByTestId } = await render(
      <Excalidraw
        handleKeyboardGlobally={true}
        fontProviders={{
          "test.provider": {
            icon: <span />,
            resolve: deferred.resolver,
            availableFonts: ["SlowQuery"],
          },
        }}
      />,
    );

    Keyboard.keyPress(KEYS.T);
    fireEvent.click(queryByTestId("font-family-show-fonts")!);
    const input = document.querySelector<HTMLInputElement>(
      ".properties-content .QuickSearch__input",
    )!;

    fireEvent.click((await screen.findByText("SlowQuery")).closest("button")!);
    await waitFor(() => expect(deferred.resolver).toHaveBeenCalledTimes(1));

    fireEvent.input(input, { target: { value: "New" } });
    await act(async () => deferred.resolve());

    expect(input.value).toBe("New");
    expect(window.h.state.currentItemFontFamily).not.toBe(
      "test.provider:SlowQuery",
    );
  });

  it("ignores a resolution after the picker closes", async () => {
    const deferred = createDeferredResolver();
    const { queryByTestId } = await render(
      <Excalidraw
        handleKeyboardGlobally={true}
        fontProviders={{
          "test.provider": {
            icon: <span />,
            resolve: deferred.resolver,
            availableFonts: ["SlowClose"],
          },
        }}
      />,
    );

    Keyboard.keyPress(KEYS.T);
    const fontPickerTrigger = queryByTestId("font-family-show-fonts")!;
    fireEvent.click(fontPickerTrigger);

    fireEvent.click((await screen.findByText("SlowClose")).closest("button")!);
    await waitFor(() => expect(deferred.resolver).toHaveBeenCalledTimes(1));

    fireEvent.click(fontPickerTrigger);
    await waitFor(() =>
      expect(
        document.querySelector(".properties-content .QuickSearch__input"),
      ).toBeNull(),
    );
    await act(async () => deferred.resolve());
    expect(window.h.state.currentItemFontFamily).not.toBe(
      "test.provider:SlowClose",
    );
  });

  it("moves keyboard navigation past a failed font", async () => {
    const resolver = vi
      .fn<FontResolver>()
      .mockImplementation(async (family) => {
        if (family === "Broken") {
          throw new Error("unavailable");
        }
        return { fontFaces, metadata };
      });
    const { queryByTestId } = await render(
      <Excalidraw
        handleKeyboardGlobally={true}
        fontProviders={{
          "test.provider": {
            icon: <span />,
            resolve: resolver,
            availableFonts: ["Alpha", "Broken", "Charlie"],
          },
        }}
      />,
    );

    Keyboard.keyPress(KEYS.T);
    fireEvent.click(queryByTestId("font-family-show-fonts")!);
    fireEvent.click((await screen.findByText("Broken")).closest("button")!);
    await waitFor(() => expect(resolver).toHaveBeenCalledWith("Broken"));

    const failedButton = document.querySelector<HTMLButtonElement>(
      'button[value="test.provider:Broken"]',
    )!;
    fireEvent.mouseMove(failedButton);
    await waitFor(() =>
      expect(
        document.querySelector('button[value="test.provider:Broken"]'),
      ).toHaveClass("dropdown-menu-item--hovered"),
    );

    const buttons = Array.from(
      document.querySelectorAll<HTMLButtonElement>(
        ".properties-content .dropdown-menu.fonts button[value]",
      ),
    );
    const failedIndex = buttons.findIndex(
      (button) => button.value === "test.provider:Broken",
    );
    const nextButton = buttons[(failedIndex + 1) % buttons.length];
    fireEvent.keyDown(document.querySelector(".properties-content")!, {
      key: KEYS.ARROW_DOWN,
    });

    await waitFor(() =>
      expect(
        document.querySelector(`button[value="${nextButton.value}"]`),
      ).toHaveClass("dropdown-menu-item--hovered"),
    );
  });

  it("preserves recalculated geometry after a keep-open selection", async () => {
    const resolver = vi
      .fn<FontResolver>()
      .mockRejectedValueOnce(new Error("temporary"))
      .mockResolvedValue({ fontFaces, metadata });
    const { queryByTestId } = await render(
      <Excalidraw
        fontProviders={{
          "test.provider": {
            icon: <span />,
            resolve: resolver,
            availableFonts: ["Tall"],
          },
        }}
      />,
    );
    const text = API.createElement({
      type: "text",
      text: "geometry",
      width: 100,
      height: 20,
    });
    API.setElements([text]);
    API.setSelectedElements([text]);

    fireEvent.click(queryByTestId("font-family-show-fonts")!);
    fireEvent.click((await screen.findByText("Tall")).closest("button")!);
    await waitFor(() => expect(resolver).toHaveBeenCalledTimes(1));
    fireEvent.click((await screen.findByText("Tall")).closest("button")!);

    await waitFor(() =>
      expect(API.getElement(text).fontFamily).toBe("test.provider:Tall"),
    );
    const selectedText = API.getElement(text);
    const selectedGeometry = {
      width: selectedText.width,
      height: selectedText.height,
    };
    expect(selectedGeometry.height).not.toBe(20);

    fireEvent.click(queryByTestId("font-family-show-fonts")!);
    await waitFor(() =>
      expect(
        document.querySelector(".properties-content .QuickSearch__input"),
      ).toBeNull(),
    );

    expect(API.getElement(text).fontFamily).toBe("test.provider:Tall");
    expect(API.getElement(text).width).toBe(selectedGeometry.width);
    expect(API.getElement(text).height).toBe(selectedGeometry.height);
  });

  it("repairs a font change measured while `document.fonts.check` lied", async () => {
    const { queryByTestId } = await render(<Excalidraw />);
    const text = API.createElement({ type: "text", text: "Hello" });
    API.setElements([text]);
    API.setSelectedElements([text]);

    // Chrome's `check()` passes for any family matching an installed system
    // font, with its web faces unloaded - the synchronous redraw measured the
    // fallback, so the faces `load()` then brings in must trigger a repair
    const check = vi.spyOn(document.fonts, "check").mockReturnValue(true);
    const fontFace = new FontFace("Nunito", "url(nunito.woff2)");
    const load = vi.spyOn(document.fonts, "load").mockResolvedValue([fontFace]);
    const onLoaded = vi.spyOn(window.h.app.fonts.instance, "onLoaded");

    try {
      fireEvent.click(queryByTestId("font-family-normal")!);

      expect(API.getElement(text).fontFamily).toBe(FONT_FAMILY.Nunito);
      expect(load).toHaveBeenCalledWith(
        expect.stringContaining("Nunito"),
        expect.anything(),
      );
      await waitFor(() => expect(onLoaded).toHaveBeenCalledWith([fontFace]));
    } finally {
      check.mockRestore();
      load.mockRestore();
      onLoaded.mockRestore();
    }
  });

  it("preserves geometry recalculated after a deferred font face load", async () => {
    // font faces of a freshly resolved family are added but not yet loaded, so
    // the redraw is deferred until `document.fonts.load` settles - only then is
    // the cache holding the pre-redraw (fallback font) geometry
    const check = vi.spyOn(document.fonts, "check").mockReturnValue(false);
    const load = vi.spyOn(document.fonts, "load").mockResolvedValue([]);

    try {
      const resolver = vi
        .fn<FontResolver>()
        .mockRejectedValueOnce(new Error("temporary"))
        .mockResolvedValue({ fontFaces, metadata });
      const { queryByTestId } = await render(
        <Excalidraw
          fontProviders={{
            "test.provider": {
              icon: <span />,
              resolve: resolver,
              availableFonts: ["Deferred"],
            },
          }}
        />,
      );
      const text = API.createElement({
        type: "text",
        text: "geometry",
        width: 100,
        height: 20,
      });
      API.setElements([text]);
      API.setSelectedElements([text]);

      fireEvent.click(queryByTestId("font-family-show-fonts")!);
      fireEvent.click((await screen.findByText("Deferred")).closest("button")!);
      await waitFor(() => expect(resolver).toHaveBeenCalledTimes(1));
      // retry, which keeps the popup open and refreshes the cache
      fireEvent.click((await screen.findByText("Deferred")).closest("button")!);

      await waitFor(() => expect(load).toHaveBeenCalled());
      await waitFor(() => expect(API.getElement(text).height).not.toBe(20));
      const redrawn = API.getElement(text);

      fireEvent.click(queryByTestId("font-family-show-fonts")!);
      await waitFor(() =>
        expect(
          document.querySelector(".properties-content .QuickSearch__input"),
        ).toBeNull(),
      );

      expect(API.getElement(text).fontFamily).toBe("test.provider:Deferred");
      expect(API.getElement(text).width).toBe(redrawn.width);
      expect(API.getElement(text).height).toBe(redrawn.height);
    } finally {
      check.mockRestore();
      load.mockRestore();
    }
  });

  it("drops an in-flight selection when the providers change", async () => {
    const check = vi.spyOn(document.fonts, "check").mockReturnValue(false);
    const load = vi.spyOn(document.fonts, "load").mockResolvedValue([]);
    let resolveSlow!: (font: Awaited<ReturnType<FontResolver>>) => void;
    const resolver = vi.fn<FontResolver>(
      () =>
        new Promise<Awaited<ReturnType<FontResolver>>>((resolve) => {
          resolveSlow = resolve;
        }),
    );
    const providers = (extraKey?: string) => ({
      "test.provider": {
        icon: <span />,
        resolve: resolver,
        availableFonts: ["SwapStale"],
      },
      ...(extraKey
        ? {
            [extraKey]: {
              icon: <span />,
              resolve: vi.fn<FontResolver>(),
              availableFonts: [],
            },
          }
        : null),
    });

    try {
      const { rerender, queryByTestId } = await render(
        <Excalidraw fontProviders={providers()} />,
      );
      const text = API.createElement({ type: "text", text: "swap" });
      API.setElements([text]);
      API.setSelectedElements([text]);
      const initialFontFamily = text.fontFamily;

      fireEvent.click(queryByTestId("font-family-show-fonts")!);
      fireEvent.click(
        (await screen.findByText("SwapStale")).closest("button")!,
      );
      await waitFor(() => expect(resolver).toHaveBeenCalledTimes(1));

      // an added provider key swaps the fonts instance mid-resolution
      const fontsBefore = window.h.app.fonts.instance;
      rerender(<Excalidraw fontProviders={providers("test.added")} />);
      await waitFor(() =>
        expect(window.h.app.fonts.instance).not.toBe(fontsBefore),
      );

      // the old instance's resolution settling must not apply its selection
      await act(async () => {
        resolveSlow({ fontFaces, metadata });
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(API.getElement(text).fontFamily).toBe(initialFontFamily);
    } finally {
      check.mockRestore();
      load.mockRestore();
    }
  });

  it("refreshes scene groups when a custom family arrives while open", async () => {
    const { queryByTestId } = await render(
      <Excalidraw
        handleKeyboardGlobally={true}
        fontProviders={{
          "test.provider": {
            icon: <span />,
            resolve: vi.fn<FontResolver>(),
            availableFonts: [],
          },
        }}
      />,
    );

    Keyboard.keyPress(KEYS.T);
    fireEvent.click(queryByTestId("font-family-show-fonts")!);
    expect(screen.queryByText("CollabArrived")).toBeNull();

    // a collab-like update: the element lands in the scene and its family
    // registers (which announces, refreshing the open picker's groups)
    const text = API.createElement({
      type: "text",
      text: "x",
      fontFamily: "test.provider:CollabArrived",
    });
    API.setElements([text]);
    act(() => {
      Fonts.registerCustomFont("test.provider:CollabArrived", metadata, {
        uri: "https://example.com/font.woff2",
      });
    });

    expect(await screen.findByText("CollabArrived")).toBeInTheDocument();
  });

  it("keeps scene groups free of a hover preview while fonts register", async () => {
    const getSceneGroupFonts = () =>
      Array.from(
        Array.from(document.querySelectorAll(".dropdown-menu-group-title"))
          .find((title) => title.textContent === "In this scene")!
          .parentElement!.querySelectorAll("button"),
      ).map((button) => button.textContent);

    const { queryByTestId } = await render(
      <Excalidraw
        fontProviders={{
          "test.provider": {
            icon: <span />,
            resolve: vi.fn<FontResolver>(),
            availableFonts: [],
          },
        }}
      />,
    );
    const check = vi.spyOn(document.fonts, "check").mockReturnValue(true);
    try {
      const text = API.createElement({
        type: "text",
        text: "Hello",
        fontFamily: FONT_FAMILY.Nunito,
      });
      API.setElements([text]);
      API.setSelectedElements([text]);

      fireEvent.click(queryByTestId("font-family-show-fonts")!);
      fireEvent.mouseMove(
        (await screen.findByText("Comic Shanns")).closest("button")!,
      );
      await waitFor(() =>
        expect(API.getElement(text).fontFamily).toBe(
          FONT_FAMILY["Comic Shanns"],
        ),
      );

      // i.e. a visible row registering its font for the preview
      act(() => {
        Fonts.registerCustomFont("test.provider:DuringPreview", metadata, {
          uri: "https://example.com/font.woff2",
        });
      });

      expect(getSceneGroupFonts()).toEqual(["Nunito"]);

      fireEvent.pointerLeave(document.querySelector(".properties-content")!);
      await waitFor(() =>
        expect(API.getElement(text).fontFamily).toBe(FONT_FAMILY.Nunito),
      );
      expect(getSceneGroupFonts()).toEqual(["Nunito"]);
    } finally {
      check.mockRestore();
    }
  });

  it("lists the current default family even when no element uses it", async () => {
    // a family searched & selected with nothing on canvas lives in no
    // element - reopening the picker must still list it
    const { queryByTestId } = await render(
      <Excalidraw
        handleKeyboardGlobally={true}
        fontProviders={{
          "test.provider": {
            icon: <span />,
            resolve: vi.fn<FontResolver>(),
            availableFonts: [],
          },
        }}
      />,
    );

    API.setAppState({ currentItemFontFamily: "test.provider:Orphaned" });

    Keyboard.keyPress(KEYS.T);
    fireEvent.click(queryByTestId("font-family-show-fonts")!);

    expect(await screen.findByText("Orphaned")).toBeInTheDocument();
  });

  it("shows a scene font it doesn't offer by the label its resolver gave", async () => {
    const { queryByTestId } = await render(
      <Excalidraw
        handleKeyboardGlobally={true}
        fontProviders={{
          "test.provider": {
            icon: <span />,
            resolve: vi.fn<FontResolver>().mockResolvedValue({
              fontFaces,
              metadata,
              label: "Brand Mono",
            }),
            availableFonts: [],
          },
        }}
      />,
    );

    API.setAppState({ currentItemFontFamily: "test.provider:9f8e7d" });
    await act(() =>
      window.h.app.fonts.instance.registerCustomFamily("test.provider:9f8e7d"),
    );

    Keyboard.keyPress(KEYS.T);
    fireEvent.click(queryByTestId("font-family-show-fonts")!);

    expect(await screen.findByText("Brand Mono")).toBeInTheDocument();
    expect(screen.queryByText("9f8e7d")).toBeNull();
  });

  it("keeps a retried selection committed during a hover preview", async () => {
    // the retry click lands while another family is hover-previewed - the
    // cache refresh must not consult the not-yet-committed hover state, or
    // the later hover-leave reset restores the pre-retry family
    const check = vi.spyOn(document.fonts, "check").mockReturnValue(false);
    const load = vi.spyOn(document.fonts, "load").mockResolvedValue([]);

    try {
      const resolver = vi
        .fn<FontResolver>()
        .mockRejectedValueOnce(new Error("temporary"))
        .mockResolvedValue({ fontFaces, metadata });
      const { queryByTestId } = await render(
        <Excalidraw
          fontProviders={{
            "test.provider": {
              icon: <span />,
              resolve: resolver,
              availableFonts: ["StaleHover"],
            },
          }}
        />,
      );
      const text = API.createElement({ type: "text", text: "stale" });
      API.setElements([text]);
      API.setSelectedElements([text]);
      const initialFontFamily = text.fontFamily;

      fireEvent.click(queryByTestId("font-family-show-fonts")!);
      fireEvent.click(
        (await screen.findByText("StaleHover")).closest("button")!,
      );
      await waitFor(() => expect(resolver).toHaveBeenCalledTimes(1));

      // hover a registered built-in row, then retry the failed one while the
      // hover preview is still live. Re-queried per hover - registration and
      // selection regroup the list, detaching previously captured row nodes
      const findBuiltinRow = () =>
        Array.from(
          document.querySelectorAll<HTMLButtonElement>(
            ".dropdown-menu.fonts button",
          ),
        ).find(
          (button) =>
            button.value &&
            !button.value.includes(":") &&
            Number(button.value) !== initialFontFamily,
        )!;
      fireEvent.mouseMove(findBuiltinRow());
      await waitFor(() =>
        expect(API.getElement(text).fontFamily).not.toBe(initialFontFamily),
      );

      fireEvent.click(
        (await screen.findByText("StaleHover")).closest("button")!,
      );
      await waitFor(() =>
        expect(API.getElement(text).fontFamily).toBe(
          "test.provider:StaleHover",
        ),
      );

      // preview again and leave - the reset must restore the retried family,
      // not the pre-retry snapshot
      fireEvent.mouseMove(findBuiltinRow());
      await waitFor(() =>
        expect(API.getElement(text).fontFamily).not.toBe(
          "test.provider:StaleHover",
        ),
      );
      fireEvent.pointerLeave(document.querySelector(".properties-content")!);

      await waitFor(() =>
        expect(API.getElement(text).fontFamily).toBe(
          "test.provider:StaleHover",
        ),
      );
    } finally {
      check.mockRestore();
      load.mockRestore();
    }
  });

  it("lets a newer selection supersede an in-flight resolution", async () => {
    const check = vi.spyOn(document.fonts, "check").mockReturnValue(false);
    const load = vi.spyOn(document.fonts, "load").mockResolvedValue([]);
    let resolveSlow!: (font: Awaited<ReturnType<FontResolver>>) => void;
    const resolver = vi.fn<FontResolver>((familyName) =>
      familyName === "SupersededSlow"
        ? new Promise<Awaited<ReturnType<FontResolver>>>((resolve) => {
            resolveSlow = resolve;
          })
        : Promise.resolve({ fontFaces, metadata }),
    );

    try {
      const { queryByTestId } = await render(
        <Excalidraw
          fontProviders={{
            "test.provider": {
              icon: <span />,
              resolve: resolver,
              availableFonts: ["SupersededSlow", "SupersededFast"],
            },
          }}
        />,
      );
      const text = API.createElement({ type: "text", text: "supersede" });
      API.setElements([text]);
      API.setSelectedElements([text]);

      fireEvent.click(queryByTestId("font-family-show-fonts")!);
      fireEvent.click(
        (await screen.findByText("SupersededSlow")).closest("button")!,
      );
      await waitFor(() =>
        expect(resolver).toHaveBeenCalledWith("SupersededSlow"),
      );

      // a second selection while the first still resolves must win, not be
      // swallowed
      fireEvent.click(
        (await screen.findByText("SupersededFast")).closest("button")!,
      );
      await waitFor(() =>
        expect(API.getElement(text).fontFamily).toBe(
          "test.provider:SupersededFast",
        ),
      );

      // the superseded resolution settling later cannot override it
      await act(async () => {
        resolveSlow({ fontFaces, metadata });
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
      expect(API.getElement(text).fontFamily).toBe(
        "test.provider:SupersededFast",
      );
    } finally {
      check.mockRestore();
      load.mockRestore();
    }
  });

  it("heals geometry when the font load settles during a hover preview", async () => {
    // when `document.fonts.load` settles while another family is being
    // hover-previewed, both the redraw and the cache refresh are (rightly)
    // suppressed - the hover-leave reset then restores pre-load geometry, so
    // the deferred refresh must redraw with the loaded faces (see the
    // batched-data effect in `actionChangeFontFamily`)
    let resolveHoverHealLoad!: (fontFaces: FontFace[]) => void;
    const check = vi.spyOn(document.fonts, "check").mockReturnValue(false);
    const load = vi
      .spyOn(document.fonts, "load")
      .mockImplementation((font: string) =>
        font.includes("hoverheal")
          ? new Promise<FontFace[]>((resolve) => {
              resolveHoverHealLoad = resolve;
            })
          : Promise.resolve([]),
      );

    try {
      const resolver = vi
        .fn<FontResolver>()
        .mockRejectedValueOnce(new Error("temporary"))
        .mockResolvedValue({ fontFaces, metadata });
      const { queryByTestId } = await render(
        <Excalidraw
          fontProviders={{
            "test.provider": {
              icon: <span />,
              resolve: resolver,
              availableFonts: ["HoverHeal"],
            },
          }}
        />,
      );
      const text = API.createElement({
        type: "text",
        text: "geometry",
        width: 100,
        height: 20,
      });
      API.setElements([text]);
      API.setSelectedElements([text]);

      fireEvent.click(queryByTestId("font-family-show-fonts")!);
      fireEvent.click(
        (await screen.findByText("HoverHeal")).closest("button")!,
      );
      await waitFor(() => expect(resolver).toHaveBeenCalledTimes(1));
      // retry - the selection keeps the popup open and kicks off the load
      fireEvent.click(
        (await screen.findByText("HoverHeal")).closest("button")!,
      );
      await waitFor(() =>
        expect(API.getElement(text).fontFamily).toBe("test.provider:HoverHeal"),
      );
      expect(resolveHoverHealLoad).toBeDefined();

      // preview a built-in family while the load is still pending
      const builtinRow = Array.from(
        document.querySelectorAll<HTMLButtonElement>(
          ".dropdown-menu.fonts button",
        ),
      ).find((button) => button.value && !button.value.includes(":"))!;
      fireEvent.mouseMove(builtinRow);
      await waitFor(() =>
        expect(API.getElement(text).fontFamily).not.toBe(
          "test.provider:HoverHeal",
        ),
      );

      // the load settles mid-hover - redraw and refresh both get deferred
      await act(async () => {
        resolveHoverHealLoad([]);
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      fireEvent.pointerLeave(document.querySelector(".properties-content")!);

      // the leave reset restores the selected family; the deferred refresh
      // must recompute its geometry (initial height of 20 was measured
      // before the faces loaded)
      await waitFor(() =>
        expect(API.getElement(text).fontFamily).toBe("test.provider:HoverHeal"),
      );
      await waitFor(() => expect(API.getElement(text).height).not.toBe(20));
    } finally {
      check.mockRestore();
      load.mockRestore();
    }
  });

  describe("provider search", () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    const resolve: FontResolver = async () => ({ fontFaces, metadata });

    const openAndSearch = async (
      providers: Record<string, FontProvider>,
      query: string,
      elements?: ExcalidrawElement[],
    ) => {
      const { queryByTestId } = await render(
        <Excalidraw
          handleKeyboardGlobally={true}
          fontProviders={providers}
          initialData={{ elements }}
        />,
      );
      Keyboard.keyPress(KEYS.T);
      fireEvent.click(queryByTestId("font-family-show-fonts")!);
      const input = document.querySelector<HTMLInputElement>(
        ".properties-content .QuickSearch__input",
      )!;
      fireEvent.input(input, { target: { value: query } });
      return input;
    };

    const rowValues = () =>
      Array.from(
        document.querySelectorAll<HTMLButtonElement>(
          ".properties-content .dropdown-menu.fonts button[value]",
        ),
        (button) => button.value,
      );

    it("lists the first matches, selecting one applies it", async () => {
      vi.spyOn(document.fonts, "check").mockReturnValue(false);
      vi.spyOn(document.fonts, "load").mockResolvedValue([]);
      const names = Array.from({ length: 12 }, (_, i) => `Sans ${i}`);
      await openAndSearch(
        {
          "test.provider": {
            icon: <span />,
            resolve,
            availableFonts: ["Sans 0"],
            search: async () => ({ kind: "match", fonts: names }),
          },
        },
        "sans",
      );

      expect(await screen.findByText("Search results")).not.toBeNull();
      // "Sans 0" is listed already, so 11 left - 10 shown
      expect(rowValues()).toEqual([
        "test.provider:Sans 0",
        ...names.slice(1, 11).map((name) => `test.provider:${name}`),
      ]);
      expect(screen.getByText("+1 more, keep typing to narrow")).not.toBeNull();

      await act(async () => {
        fireEvent.click(screen.getByText("Sans 3").closest("button")!);
      });

      expect(window.h.state.currentItemFontFamily).toBe("test.provider:Sans 3");
    });

    const pressEnter = () =>
      act(async () => {
        fireEvent.keyDown(document.querySelector(".properties-content")!, {
          key: KEYS.ENTER,
        });
      });

    it("suggests only when nothing matches, never on a bare Enter", async () => {
      const fuzzyResolve = vi.fn<FontResolver>(resolve);
      await openAndSearch(
        {
          "test.fuzzy": {
            icon: <span />,
            resolve: fuzzyResolve,
            availableFonts: [],
            search: async () => ({ kind: "suggestion", fonts: ["Roboto"] }),
          },
        },
        "rovoto",
      );

      expect(await screen.findByText("Did you mean…")).not.toBeNull();
      expect(rowValues()).toEqual(["test.fuzzy:Roboto"]);

      // Enter with no row highlighted selects nothing
      await pressEnter();

      expect(fuzzyResolve).not.toHaveBeenCalled();
    });

    it("never tries a typed name as a font of its own", async () => {
      // neither for a provider that can't search nor for one whose search
      // failed - ids aren't necessarily something a user could type
      const plainResolve = vi.fn<FontResolver>(resolve);
      const brokenResolve = vi.fn<FontResolver>(resolve);
      vi.spyOn(console, "error").mockImplementation(() => {});
      await openAndSearch(
        {
          "test.plain": {
            icon: <span />,
            resolve: plainResolve,
            availableFonts: [],
          },
          "test.broken": {
            icon: <span />,
            resolve: brokenResolve,
            availableFonts: [],
            search: async () => {
              throw new Error("offline");
            },
          },
        },
        "Roboto",
      );

      expect(await screen.findByText("No fonts found")).not.toBeNull();
      expect(rowValues()).toEqual([]);

      await pressEnter();

      expect(plainResolve).not.toHaveBeenCalled();
      expect(brokenResolve).not.toHaveBeenCalled();
    });

    it("shows a font by its label, and saves it by its id", async () => {
      vi.spyOn(document.fonts, "check").mockReturnValue(false);
      vi.spyOn(document.fonts, "load").mockResolvedValue([]);
      const labelResolve = vi.fn<FontResolver>(resolve);
      await openAndSearch(
        {
          "test.provider": {
            icon: <span />,
            resolve: labelResolve,
            availableFonts: [{ id: "a1b2c3", label: "Brand Sans" }],
            search: async () => ({
              kind: "match",
              fonts: [{ id: "d4e5f6", label: "Brand Serif" }],
            }),
          },
        },
        "brand",
      );

      expect(await screen.findByText("Search results")).not.toBeNull();
      // the offered font is found by its label, and so is the search result
      expect(rowValues()).toEqual([
        "test.provider:a1b2c3",
        "test.provider:d4e5f6",
      ]);
      expect(screen.queryByText("a1b2c3")).toBeNull();

      await act(async () => {
        fireEvent.click(screen.getByText("Brand Serif").closest("button")!);
      });

      expect(labelResolve).toHaveBeenCalledWith("d4e5f6");
      expect(window.h.state.currentItemFontFamily).toBe("test.provider:d4e5f6");
    });

    it("shows a pending search as such", async () => {
      await openAndSearch(
        {
          "test.provider": {
            icon: <span />,
            resolve,
            availableFonts: [],
            search: () => new Promise(() => {}),
          },
        },
        "rovoto",
      );

      expect(screen.getByText("Searching…")).not.toBeNull();
    });

    it("keeps focus in the popup after a keep-open selection while editing", async () => {
      vi.spyOn(document.fonts, "check").mockReturnValue(false);
      vi.spyOn(document.fonts, "load").mockResolvedValue([]);
      vi.spyOn(console, "error").mockImplementation(() => {});
      // a retry is the selection which keeps the popup open
      let isOffline = true;
      const { queryByTestId } = await render(
        <Excalidraw
          handleKeyboardGlobally={true}
          fontProviders={{
            "test.provider": {
              icon: <span />,
              resolve: async (familyName) => {
                if (isOffline) {
                  throw new Error("offline");
                }
                return resolve(familyName);
              },
              availableFonts: ["Foo"],
            },
          }}
        />,
      );
      const flushTimers = () =>
        act(() => new Promise((resolve) => setTimeout(resolve, 10)));
      // as a real click, which the text editor tells apart from leaving it
      const press = (target: Element) => {
        fireEvent.pointerDown(target);
        fireEvent.pointerUp(target);
        fireEvent.click(target);
      };
      Keyboard.keyPress(KEYS.T);
      new Pointer("mouse").clickAt(100, 100);
      await flushTimers();
      expect(h.state.editingTextElement).not.toBeNull();

      press(queryByTestId("font-family-show-fonts")!);
      const input = await waitFor(() => {
        const input = document.querySelector<HTMLInputElement>(
          ".properties-content .QuickSearch__input",
        );
        expect(input).not.toBeNull();
        return input!;
      });
      press(input);
      input.focus();
      await flushTimers();
      fireEvent.input(input, { target: { value: "Foo" } });
      fireEvent.keyDown(document.querySelector(".properties-content")!, {
        key: KEYS.ARROW_DOWN,
      });
      await pressEnter();
      await waitFor(() =>
        expect(
          document.querySelector(".FontPicker__font--failed"),
        ).not.toBeNull(),
      );

      isOffline = false;
      await pressEnter();

      await waitFor(() =>
        expect(h.state.currentItemFontFamily).toBe("test.provider:Foo"),
      );
      await flushTimers();
      expect(h.state.editingTextElement).not.toBeNull();
      expect(h.state.openPopup).toBe("fontFamily");
      expect(document.activeElement).toBe(input);
    });

    it("shares the result slots between providers", async () => {
      const names = (prefix: string, count: number) =>
        Array.from({ length: count }, (_, i) => `${prefix} Sans ${i}`);
      const provider = (familyNames: string[]): FontProvider => ({
        icon: <span />,
        resolve,
        availableFonts: [],
        search: async () => ({ kind: "match", fonts: familyNames }),
      });
      await openAndSearch(
        {
          "test.big": provider(names("Big", 25)),
          "test.small": provider(names("Small", 3)),
        },
        "sans",
      );

      await screen.findByText("Search results");
      // the short list's unused slots go to the long one, order kept
      expect(rowValues()).toEqual([
        ...names("Big", 7).map((name) => `test.big:${name}`),
        ...names("Small", 3).map((name) => `test.small:${name}`),
      ]);
      expect(
        screen.getByText("+18 more, keep typing to narrow"),
      ).not.toBeNull();
    });

    it("drops suggestions while another provider matches", async () => {
      await openAndSearch(
        {
          "test.fuzzy": {
            icon: <span />,
            resolve,
            availableFonts: [],
            search: async () => ({ kind: "suggestion", fonts: ["Lobster"] }),
          },
          "test.exact": {
            icon: <span />,
            resolve,
            availableFonts: [],
            search: async () => ({ kind: "match", fonts: ["Lobster Two"] }),
          },
        },
        "lobster t",
      );

      await screen.findByText("Search results");
      expect(rowValues()).toEqual(["test.exact:Lobster Two"]);
      expect(screen.queryByText("Did you mean…")).toBeNull();
    });

    it("aborts a superseded search", async () => {
      const signals: AbortSignal[] = [];
      const input = await openAndSearch(
        {
          "test.provider": {
            icon: <span />,
            resolve,
            availableFonts: [],
            search: (_query, { signal }) => {
              signals.push(signal);
              return new Promise(() => {});
            },
          },
        },
        "rob",
      );

      await waitFor(() => expect(signals).toHaveLength(1));
      fireEvent.input(input, { target: { value: "robo" } });

      expect(signals[0].aborted).toBe(true);
      await waitFor(() => expect(signals).toHaveLength(2));
    });
  });

  describe("list", () => {
    const resolve: FontResolver = async () => ({ fontFaces, metadata });

    const open = async (
      props?: Pick<ExcalidrawProps, "fontProviders" | "fontFavorites">,
      /** what's on canvas as the picker opens */
      elements: readonly ExcalidrawElement[] = [],
    ) => {
      const { queryByTestId } = await render(
        <Excalidraw handleKeyboardGlobally={true} {...props} />,
      );
      API.setElements(elements);
      Keyboard.keyPress(KEYS.T);
      fireEvent.click(queryByTestId("font-family-show-fonts")!);
      await screen.findByText("Available fonts");
    };

    const getGroupFamilies = (title: string) =>
      Array.from(
        screen
          .getByText(title)
          .closest(".dropdown-menu-group")!
          .querySelectorAll<HTMLElement>("button[value]"),
      ).map((button) => button.title);

    it("leads the available fonts with our own, ahead of a provider's", async () => {
      await open({
        fontProviders: {
          "test.provider": {
            icon: <span />,
            resolve,
            // would sort first
            availableFonts: ["Aardvark", "Zebra"],
          },
        },
      });

      expect(getGroupFamilies("Available fonts")).toEqual([
        "Excalifont",
        "Nunito",
        "Comic Shanns",
        "Lilita One",
        "Aardvark",
        "Zebra",
      ]);
    });

    it("counts a font as the scene's only once an element uses it", async () => {
      await open(undefined, [
        API.createElement({
          type: "text",
          text: "x",
          fontFamily: FONT_FAMILY.Nunito,
        }),
      ]);

      // Excalifont is the current font (what the next text gets), in no
      // element as yet
      expect(getGroupFamilies("In this scene")).toEqual(["Nunito"]);
      expect(getGroupFamilies("Available fonts")).toEqual([
        "Excalifont",
        "Comic Shanns",
        "Lilita One",
      ]);
    });

    it("lists deprecated fonts of ours right below the current ones", async () => {
      const { queryByTestId } = await render(
        <Excalidraw
          handleKeyboardGlobally={true}
          showDeprecatedFonts={true}
          fontProviders={{
            "test.provider": {
              icon: <span />,
              resolve,
              availableFonts: ["Aardvark"],
            },
          }}
        />,
      );
      Keyboard.keyPress(KEYS.T);
      fireEvent.click(queryByTestId("font-family-show-fonts")!);
      await screen.findByText("Available fonts");

      expect(getGroupFamilies("Available fonts")).toEqual([
        "Excalifont",
        "Nunito",
        "Comic Shanns",
        "Lilita One",
        "Cascadia",
        "Helvetica",
        "Virgil",
        "Aardvark",
      ]);
    });

    describe("loading more", () => {
      // jsdom has no layout: a list of 1000px in a 100px viewport, so that
      // only a scroll gets to its end
      beforeEach(() => {
        vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(
          1000,
        );
        vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(
          100,
        );
      });

      const page = (prefix: string, count: number) =>
        Array.from({ length: count }, (_, i) => `${prefix} ${i}`);

      it("appends a provider's fonts on demand, then as the list's end is reached", async () => {
        const loadMore = vi
          .fn<NonNullable<FontProvider["loadMore"]>>()
          // not in alphabetical order, and holding a font listed already
          .mockResolvedValueOnce(["Zulu", "Aardvark", ...page("First", 18)])
          .mockResolvedValueOnce(page("Second", 3));
        await open({
          fontProviders: {
            "test.provider": {
              icon: <span />,
              resolve,
              availableFonts: ["Aardvark", "Mango"],
              loadMore,
            },
          },
        });
        const input = document.querySelector<HTMLInputElement>(
          ".properties-content .QuickSearch__input",
        )!;
        input.focus();

        fireEvent.click(screen.getByText("Browse more fonts"));
        expect(loadMore).toHaveBeenCalledWith(
          expect.objectContaining({ offset: 0, limit: 20 }),
        );

        // at the end, as they came - what was listed doesn't move
        await waitFor(() =>
          expect(getGroupFamilies("Available fonts")).toEqual([
            "Excalifont",
            "Nunito",
            "Comic Shanns",
            "Lilita One",
            "Aardvark",
            "Mango",
            "Zulu",
            ...page("First", 18),
          ]),
        );
        expect(document.activeElement).toBe(input);
        expect(loadMore).toHaveBeenCalledTimes(1);

        // from now on, reaching the end of the list is enough
        const list = document.querySelector<HTMLElement>(
          ".properties-content .dropdown-menu.fonts",
        )!;
        list.scrollTop = 900;
        fireEvent.scroll(list);

        await waitFor(() =>
          expect(getGroupFamilies("Available fonts").slice(-3)).toEqual(
            page("Second", 3),
          ),
        );
        expect(loadMore).toHaveBeenLastCalledWith(
          expect.objectContaining({ offset: 20 }),
        );
        // a short page was the last one
        expect(screen.queryByText("Browse more fonts")).toBe(null);
        // nothing says the provider has more
        expect(screen.queryByText("Use search for more")).toBe(null);
      });

      it("points at the search once a provider able to search has no more to load", async () => {
        await open({
          fontProviders: {
            "test.provider": {
              icon: <span />,
              resolve,
              availableFonts: ["Aardvark"],
              loadMore: vi
                .fn<NonNullable<FontProvider["loadMore"]>>()
                .mockResolvedValueOnce(page("Only", 3)),
              search: async () => ({ kind: "match", fonts: [] }),
            },
          },
        });
        expect(screen.queryByText("Use search for more")).toBe(null);

        fireEvent.click(screen.getByText("Browse more fonts"));

        expect(
          await screen.findByText("Use search for more"),
        ).toBeInTheDocument();
        expect(screen.queryByText("Browse more fonts")).toBe(null);
      });

      it("keeps what got loaded, and loading at the list's end, when the picker reopens", async () => {
        const loadMore = vi
          .fn<NonNullable<FontProvider["loadMore"]>>()
          .mockResolvedValueOnce(page("First", 20))
          .mockResolvedValueOnce(page("Second", 20));
        await open({
          fontProviders: {
            "test.provider": {
              icon: <span />,
              resolve,
              availableFonts: ["Aardvark"],
              loadMore,
            },
          },
        });

        fireEvent.click(screen.getByText("Browse more fonts"));
        await screen.findByTitle("First 19");

        // close (picking a font does), and open again
        fireEvent.click(screen.getByTitle("Nunito"));
        await waitFor(() =>
          expect(document.querySelector(".properties-content")).toBe(null),
        );
        fireEvent.click(screen.getByTestId("font-family-show-fonts"));
        await screen.findByText("Available fonts");

        expect(getGroupFamilies("Available fonts").slice(-2)).toEqual([
          "First 18",
          "First 19",
        ]);
        expect(loadMore).toHaveBeenCalledTimes(1);

        // no click needed this time
        const list = document.querySelector<HTMLElement>(
          ".properties-content .dropdown-menu.fonts",
        )!;
        list.scrollTop = 900;
        fireEvent.scroll(list);
        await screen.findByTitle("Second 19");
        // carrying on from where it was
        expect(loadMore).toHaveBeenNthCalledWith(
          2,
          expect.objectContaining({ offset: 20 }),
        );
      });

      it("lists nothing on a scroll before it was asked for, nor offers it while searching", async () => {
        const loadMore = vi
          .fn<NonNullable<FontProvider["loadMore"]>>()
          .mockResolvedValue(["Zulu"]);
        await open({
          fontProviders: {
            "test.provider": {
              icon: <span />,
              resolve,
              availableFonts: ["Aardvark"],
              loadMore,
            },
          },
        });
        // the look ahead, which tells whether there is anything to offer
        await screen.findByText("Browse more fonts");
        const list = document.querySelector<HTMLElement>(
          ".properties-content .dropdown-menu.fonts",
        )!;
        list.scrollTop = 900;
        fireEvent.scroll(list);
        expect(loadMore).toHaveBeenCalledTimes(1);
        expect(screen.queryByText("Zulu")).toBe(null);

        fireEvent.input(
          document.querySelector(".properties-content .QuickSearch__input")!,
          { target: { value: "aard" } },
        );
        await waitFor(() =>
          expect(screen.queryByText("Browse more fonts")).toBe(null),
        );
      });

      it("offers nothing more when a provider has no font beyond the listed ones", async () => {
        const loadMore = vi
          .fn<NonNullable<FontProvider["loadMore"]>>()
          .mockResolvedValue(["Aardvark"]);
        await open({
          fontProviders: {
            "test.provider": {
              icon: <span />,
              resolve,
              availableFonts: ["Aardvark"],
              loadMore,
            },
          },
        });

        await waitFor(() => expect(loadMore).toHaveBeenCalledTimes(1));
        await act(async () => {});
        expect(screen.queryByText("Browse more fonts")).toBe(null);
      });

      it("offers more also when the scene uses every available font", async () => {
        await open(
          {
            fontProviders: {
              "test.provider": {
                resolve,
                availableFonts: [],
                loadMore: async () => ["Zulu"],
              },
            },
          },
          [
            FONT_FAMILY.Excalifont,
            FONT_FAMILY.Nunito,
            FONT_FAMILY["Comic Shanns"],
            FONT_FAMILY["Lilita One"],
          ].map((fontFamily) =>
            API.createElement({ type: "text", text: "a", fontFamily }),
          ),
        );

        expect(getGroupFamilies("Available fonts")).toEqual([]);
        fireEvent.click(await screen.findByText("Browse more fonts"));
        await screen.findByText("Zulu");
      });

      it("offers nothing more without a provider able to page", async () => {
        await open({
          fontProviders: {
            "test.provider": {
              icon: <span />,
              resolve,
              availableFonts: ["Aardvark"],
              search: async () => ({ kind: "match", fonts: [] }),
            },
          },
        });

        expect(screen.queryByText("Browse more fonts")).toBe(null);
      });
    });

    it("lists a favorite once, below the scene's fonts", async () => {
      await open(
        {
          fontFavorites: {
            // the scene's font stays with the scene
            fonts: [FONT_FAMILY.Nunito, FONT_FAMILY.Excalifont],
            onChange: vi.fn(),
          },
        },
        [API.createElement({ type: "text", text: "x" })],
      );

      expect(getGroupFamilies("In this scene")).toEqual(["Excalifont"]);
      expect(getGroupFamilies("Favorites")).toEqual(["Nunito"]);
      expect(getGroupFamilies("Available fonts")).toEqual([
        "Comic Shanns",
        "Lilita One",
      ]);
      expect(
        Array.from(
          document.querySelectorAll(".dropdown-menu-group-title"),
          (title) => title.textContent,
        ),
      ).toEqual(["In this scene", "Favorites", "Available fonts"]);
    });

    it("scrolls to the highlighted font on open and on keyboard navigation only", async () => {
      const scrollIntoView = vi.fn();
      const original = HTMLElement.prototype.scrollIntoView;
      HTMLElement.prototype.scrollIntoView = scrollIntoView;

      try {
        await open();
        const popup = document.querySelector(".properties-content")!;
        const getRow = (title: string) =>
          document.querySelector<HTMLElement>(
            `.dropdown-menu.fonts [title="${title}"]`,
          )!;

        // the selected font, as the picker opens
        expect(scrollIntoView).toHaveBeenCalledTimes(1);
        expect(scrollIntoView.mock.contexts[0]).toBe(getRow("Excalifont"));

        // a hover preview, and its end - when the highlight falls back to the
        // selected font - leave the list where it is
        fireEvent.mouseMove(getRow("Lilita One"));
        await waitFor(() =>
          expect(h.state.currentHoveredFontFamily).toBe(
            FONT_FAMILY["Lilita One"],
          ),
        );
        fireEvent.pointerLeave(popup);
        await waitFor(() =>
          expect(h.state.currentHoveredFontFamily).toBe(null),
        );
        expect(scrollIntoView).toHaveBeenCalledTimes(1);

        // the keyboard moves the highlight where the pointer isn't
        fireEvent.keyDown(popup, { key: KEYS.ARROW_DOWN });
        await waitFor(() => expect(scrollIntoView).toHaveBeenCalledTimes(2));
        expect(scrollIntoView.mock.contexts[1]).toBe(getRow("Nunito"));
      } finally {
        HTMLElement.prototype.scrollIntoView = original;
      }
    });
  });

  describe("top picks drag & drop", () => {
    const SLOT_SIZE = 32;
    const SLOT_SPAN = 40;

    // jsdom has no layout — lay the strip slots out horizontally, and
    // everything else (the list rows) well below the strip
    beforeEach(() => {
      vi.spyOn(
        HTMLElement.prototype,
        "getBoundingClientRect",
      ).mockImplementation(function (this: HTMLElement) {
        const index = this.dataset.topPickIndex;
        if (index != null) {
          return new DOMRect(
            Number(index) * SLOT_SPAN,
            0,
            SLOT_SIZE,
            SLOT_SIZE,
          );
        }
        if (this.classList.contains("top-picks-dnd")) {
          return new DOMRect(0, 0, SLOT_SPAN * 2 + SLOT_SIZE, SLOT_SIZE);
        }
        if (this.classList.contains("FontPicker__favorites-drop-zone")) {
          return new DOMRect(0, 100, 200, 30);
        }
        return new DOMRect(0, 300, SLOT_SIZE, SLOT_SIZE);
      });
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    const slotCenter = (index: number) => ({
      clientX: index * SLOT_SPAN + SLOT_SIZE / 2,
      clientY: SLOT_SIZE / 2,
    });

    const drag = async (
      source: HTMLElement,
      from: { clientX: number; clientY: number },
      to: { clientX: number; clientY: number },
    ) => {
      fireEvent.pointerDown(source, { pointerId: 1, button: 0, ...from });
      // wait out the sloppy-click grace period
      await new Promise((resolve) => setTimeout(resolve, 120));
      fireEvent.pointerMove(window, { pointerId: 1, ...to });
      fireEvent.pointerUp(window, { pointerId: 1, ...to });
      // let the post-drop click suppression lapse
      await new Promise((resolve) => setTimeout(resolve, 120));
    };

    const getStripFamilies = (container: HTMLElement) =>
      Array.from(
        container.querySelectorAll<HTMLElement>(
          ".FontPicker__top-picks [data-top-pick-index]",
        ),
      ).map((button) => button.title);

    const openFontPicker = async (
      props?: Pick<ExcalidrawProps, "fontPickerTip" | "fontFavorites">,
    ) => {
      const utils = await render(
        <Excalidraw handleKeyboardGlobally={true} {...props} />,
      );
      Keyboard.keyPress(KEYS.T);
      act(() => {
        utils.queryByTestId("font-family-show-fonts")!.click();
      });
      await waitFor(() =>
        expect(
          document.querySelector('.dropdown-menu.fonts [title="Lilita One"]'),
        ).not.toBeNull(),
      );
      return utils;
    };

    it("pins a font dragged from the list, replacing the hovered slot", async () => {
      const { container } = await openFontPicker();

      const row = document.querySelector<HTMLElement>(
        '.dropdown-menu.fonts [title="Lilita One"]',
      )!;
      await drag(row, { clientX: 16, clientY: 316 }, slotCenter(1));

      await waitFor(() =>
        expect(h.state.fontTopPicks).toEqual([
          FONT_FAMILY.Excalifont,
          FONT_FAMILY["Lilita One"],
          FONT_FAMILY["Comic Shanns"],
        ]),
      );
      expect(getStripFamilies(container)).toEqual([
        "Hand-drawn",
        "Lilita One",
        "Code",
      ]);
      // pinning doesn't pick the font
      expect(h.state.currentItemFontFamily).not.toBe(FONT_FAMILY["Lilita One"]);
    });

    it("pins a custom font as its preview text, resolving it on select", async () => {
      vi.spyOn(document.fonts, "check").mockReturnValue(false);
      vi.spyOn(document.fonts, "load").mockResolvedValue([]);
      const deferred = createDeferredResolver();
      let resolvePreviewText!: (text: string) => void;
      const { container, queryByTestId } = await render(
        <Excalidraw
          handleKeyboardGlobally={true}
          fontProviders={{
            "test.provider": {
              icon: <span />,
              resolve: deferred.resolver,
              availableFonts: ["Pinned"],
              getPreviewText: () =>
                new Promise((resolve) => (resolvePreviewText = resolve)),
            },
          }}
        />,
      );
      Keyboard.keyPress(KEYS.T);
      act(() => {
        queryByTestId("font-family-show-fonts")!.click();
      });

      const row = (await screen.findByText("Pinned")).closest("button")!;
      await drag(row, { clientX: 16, clientY: 316 }, slotCenter(1));

      await waitFor(() =>
        expect(h.state.fontTopPicks).toEqual([
          FONT_FAMILY.Excalifont,
          "test.provider:Pinned",
          FONT_FAMILY["Comic Shanns"],
        ]),
      );
      const pick = container.querySelector<HTMLElement>(
        '.FontPicker__top-picks [data-top-pick-index="1"]',
      )!;
      expect(pick.querySelector("svg")).toBe(null);
      expect(pick.textContent).toBe("Aa");
      await act(async () => resolvePreviewText("あ"));
      expect(pick.textContent).toBe("あ");

      fireEvent.click(pick);
      expect(h.state.currentItemFontFamily).not.toBe("test.provider:Pinned");
      await act(async () => deferred.resolve());
      await waitFor(() =>
        expect(h.state.currentItemFontFamily).toBe("test.provider:Pinned"),
      );
    });

    it("refuses pinning an already pinned font", async () => {
      await openFontPicker();

      const row = document.querySelector<HTMLElement>(
        '.dropdown-menu.fonts [title="Nunito"]',
      )!;
      await drag(row, { clientX: 16, clientY: 316 }, slotCenter(0));

      expect(h.state.fontTopPicks).toBe(null);
    });

    it("reorders picks dragged within the strip", async () => {
      const { container } = await openFontPicker();

      const firstPick = container.querySelector<HTMLElement>(
        '.FontPicker__top-picks [data-top-pick-index="0"]',
      )!;
      await drag(firstPick, slotCenter(0), slotCenter(2));

      await waitFor(() =>
        expect(h.state.fontTopPicks).toEqual([
          FONT_FAMILY.Nunito,
          FONT_FAMILY["Comic Shanns"],
          FONT_FAMILY.Excalifont,
        ]),
      );
      expect(getStripFamilies(container)).toEqual([
        "Normal",
        "Code",
        "Hand-drawn",
      ]);
    });

    it("pads a short customized list with unpicked defaults", async () => {
      const { container } = await openFontPicker();

      act(() => {
        API.setAppState({ fontTopPicks: [FONT_FAMILY["Lilita One"]] });
      });
      await waitFor(() =>
        expect(getStripFamilies(container)).toEqual([
          "Lilita One",
          "Hand-drawn",
          "Normal",
        ]),
      );

      // padded defaults count as pinned
      const row = document.querySelector<HTMLElement>(
        '.dropdown-menu.fonts [title="Nunito"]',
      )!;
      await drag(row, { clientX: 16, clientY: 316 }, slotCenter(0));
      expect(h.state.fontTopPicks).toEqual([FONT_FAMILY["Lilita One"]]);

      // dropping on a padded slot persists the full strip
      const code = document.querySelector<HTMLElement>(
        '.dropdown-menu.fonts [title="Comic Shanns"]',
      )!;
      await drag(code, { clientX: 16, clientY: 316 }, slotCenter(1));
      await waitFor(() =>
        expect(h.state.fontTopPicks).toEqual([
          FONT_FAMILY["Lilita One"],
          FONT_FAMILY["Comic Shanns"],
          FONT_FAMILY.Nunito,
        ]),
      );
    });

    const getFavoritesDropZone = () =>
      document.querySelector<HTMLElement>(".FontPicker__favorites-drop-zone");

    // the zone only mounts once a drag is in flight, so it takes a move to
    // start the drag and another one to get onto it
    const dragToFavorites = async (source: HTMLElement) => {
      fireEvent.pointerDown(source, {
        pointerId: 1,
        button: 0,
        clientX: 16,
        clientY: 316,
      });
      await new Promise((resolve) => setTimeout(resolve, 120));
      fireEvent.pointerMove(window, {
        pointerId: 1,
        clientX: 16,
        clientY: 200,
      });
      const label = getFavoritesDropZone()?.textContent ?? null;
      fireEvent.pointerMove(window, {
        pointerId: 1,
        clientX: 100,
        clientY: 115,
      });
      fireEvent.pointerUp(window, { pointerId: 1, clientX: 100, clientY: 115 });
      await new Promise((resolve) => setTimeout(resolve, 120));
      return label;
    };

    const getGroupFamilies = (title: string) =>
      Array.from(
        screen
          .queryByText(title)
          ?.closest(".dropdown-menu-group")
          ?.querySelectorAll<HTMLElement>("button[value]") ?? [],
      ).map((button) => button.title);

    it("adds a font dropped on the favorites zone, and removes it the same way", async () => {
      const Host = () => {
        const [fonts, setFonts] = React.useState<
          NonNullable<ExcalidrawProps["fontFavorites"]>["fonts"]
        >([]);
        return (
          <Excalidraw
            handleKeyboardGlobally={true}
            fontFavorites={{ fonts, onChange: setFonts }}
          />
        );
      };
      const { queryByTestId } = await render(<Host />);
      Keyboard.keyPress(KEYS.T);
      act(() => {
        queryByTestId("font-family-show-fonts")!.click();
      });
      const getRow = () =>
        document.querySelector<HTMLElement>(
          '.dropdown-menu.fonts [title="Lilita One"]',
        )!;
      await waitFor(() => expect(getRow()).not.toBeNull());
      expect(getFavoritesDropZone()).toBe(null);
      // the zone shows up only once a drag starts - the tip tells of it
      expect(
        document.querySelector<HTMLElement>(".FontPicker__tip")!.textContent,
      ).toBe("Drag a font to pin");

      const input = document.querySelector<HTMLInputElement>(
        ".properties-content .QuickSearch__input",
      )!;
      input.blur();

      expect(await dragToFavorites(getRow())).toBe("Drag to favorite");
      // the drag took the focus - the search has it back
      expect(document.activeElement).toBe(input);

      // in a section of its own, and no longer among the available ones
      await waitFor(() =>
        expect(getGroupFamilies("Favorites")).toEqual(["Lilita One"]),
      );
      expect(getGroupFamilies("Available fonts")).not.toContain("Lilita One");
      expect(getFavoritesDropZone()).toBe(null);
      // dropping is not selecting
      expect(h.state.currentItemFontFamily).toBe(FONT_FAMILY.Excalifont);

      expect(await dragToFavorites(getRow())).toBe("Remove favorite");

      await waitFor(() => expect(screen.queryByText("Favorites")).toBe(null));
      expect(getGroupFamilies("Available fonts")).toContain("Lilita One");
    });

    it("offers no favorites zone unless the host keeps favorites", async () => {
      await openFontPicker();
      const row = document.querySelector<HTMLElement>(
        '.dropdown-menu.fonts [title="Lilita One"]',
      )!;

      expect(await dragToFavorites(row)).toBe(null);
      // a drag which went nowhere hands the focus back all the same
      expect(document.activeElement).toBe(
        document.querySelector(".properties-content .QuickSearch__input"),
      );
    });

    it("shows the host's tip in place of its own", async () => {
      await openFontPicker({
        fontPickerTip: (
          <span className="host-tip">Fonts are set by your team</span>
        ),
      });
      const tip = document.querySelector<HTMLElement>(".FontPicker__tip")!;

      expect(tip.querySelector(".host-tip")).not.toBe(null);
      expect(tip.textContent).not.toContain("drag any font");

      // the editor's reset link stays next to it
      act(() => {
        API.setAppState({ fontTopPicks: [FONT_FAMILY.Nunito] });
      });
      await waitFor(() =>
        expect(tip.textContent).toBe("Fonts are set by your team · Reset"),
      );
    });

    it("shows no tip text when the host passes null", async () => {
      await openFontPicker({ fontPickerTip: null });

      expect(
        document.querySelector<HTMLElement>(".FontPicker__tip")!.textContent,
      ).toBe("");
    });

    it("resets customized picks from the tip's reset link", async () => {
      await openFontPicker();

      const getResetLink = () =>
        document.querySelector<HTMLElement>(
          ".FontPicker__tip .top-picks-dnd__tip-reset",
        );
      // nothing to reset while the picks are the defaults
      expect(getResetLink()).toBe(null);

      act(() => {
        API.setAppState({
          fontTopPicks: [FONT_FAMILY["Lilita One"], FONT_FAMILY.Nunito],
        });
      });
      await waitFor(() => expect(getResetLink()).not.toBe(null));

      act(() => {
        getResetLink()!.click();
      });

      expect(h.state.fontTopPicks).toBe(null);
      expect(h.state.openPopup).toBe("fontFamily");
      await waitFor(() => expect(getResetLink()).toBe(null));
    });
  });
});

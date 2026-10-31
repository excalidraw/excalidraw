import { fireEvent, screen, waitFor } from "@testing-library/react";

import { FONT_FAMILY, KEYS } from "@excalidraw/common";
import { Scene } from "@excalidraw/element";

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
import type { FontProvider } from "../../types";

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
      provider: {
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
    rerender(<Excalidraw fontProviders={providers("added")} />);
    await waitFor(() => expect(window.h.app.fonts.instance).not.toBe(fonts));
  });

  it("does not offer custom resolution without providers", async () => {
    const { queryByTestId } = await render(
      <Excalidraw handleKeyboardGlobally={true} />,
    );

    Keyboard.keyPress(KEYS.T);
    fireEvent.click(queryByTestId("font-family-show-fonts")!);
    const input = document.querySelector<HTMLInputElement>(
      ".properties-content .QuickSearch__input",
    )!;
    fireEvent.input(input, { target: { value: "Unknown" } });

    await waitFor(() =>
      expect(
        document.querySelectorAll(
          ".properties-content .dropdown-menu.fonts > button[value]",
        ),
      ).toHaveLength(0),
    );
    expect(screen.getByText("No fonts found")).toBeInTheDocument();
    expect(
      document.querySelector(
        ".properties-content .dropdown-menu.fonts > button:not([value])",
      ),
    ).toBeNull();
  });

  it("does not expose custom fonts cached by another editor", async () => {
    const fonts = new Fonts(new Scene(), {
      hidden: vi.fn().mockResolvedValue({ fontFaces, metadata }),
    });
    await fonts.registerCustomFamily("hidden:Global");

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
    let containerVersion = API.getElement(container).version;
    for (const fontName of ["Nunito", "Comic Shanns"] as const) {
      fireEvent.mouseMove(
        (await screen.findByText(fontName)).closest("button")!,
      );
      await waitFor(() =>
        expect(API.getElement(text).fontFamily).toBe(FONT_FAMILY[fontName]),
      );
      expect(API.getElement(text).version).toBeGreaterThan(textVersion);
      expect(API.getElement(container).version).toBeGreaterThan(
        containerVersion,
      );
      textVersion = API.getElement(text).version;
      containerVersion = API.getElement(container).version;
    }

    fireEvent.click(trigger);

    await waitFor(() =>
      expect(API.getElement(text).fontFamily).toBe(initialFontFamily),
    );
    expect(API.getElement(text).version).toBeGreaterThan(textVersion);
    expect(API.getElement(container).version).toBeGreaterThan(containerVersion);
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

  it("reverts a hover preview after an Escape, which keeps the popup open", async () => {
    const { queryByTestId } = await render(<Excalidraw />);
    const text = API.createElement({ type: "text", text: "Hello" });
    API.setElements([text]);
    API.setSelectedElements([text]);
    const initialFontFamily = API.getElement(text).fontFamily;

    fireEvent.click(queryByTestId("font-family-show-fonts")!);
    const comicShanns = (await screen.findByText("Comic Shanns")).closest(
      "button",
    )!;

    // as do compact mode refocusing the text editor and StrictMode
    fireEvent.keyDown(
      document.querySelector(".properties-content .QuickSearch__input")!,
      { key: KEYS.ESCAPE },
    );
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

  it("registers a visible available font before previewing it", async () => {
    const restoreIntersectionObserver = mockVisibleIntersections();
    const deferred = createDeferredResolver();
    try {
      const { queryByTestId } = await render(
        <Excalidraw
          fontProviders={{
            provider: {
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
        expect(API.getElement(text).fontFamily).toBe("provider:Kings"),
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
            provider: {
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
    const onNewFontUsed = vi.fn();
    const { queryByTestId } = await render(
      <Excalidraw
        handleKeyboardGlobally={true}
        fontProviders={{
          provider: {
            icon: <span />,
            resolve: deferred.resolver,
            availableFonts: ["SlowQuery"],
            onNewFontUsed,
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
    expect(onNewFontUsed).not.toHaveBeenCalled();
    expect(window.h.state.currentItemFontFamily).not.toBe("provider:SlowQuery");
  });

  it("ignores a resolution after the picker closes", async () => {
    const deferred = createDeferredResolver();
    const onNewFontUsed = vi.fn();
    const { queryByTestId } = await render(
      <Excalidraw
        handleKeyboardGlobally={true}
        fontProviders={{
          provider: {
            icon: <span />,
            resolve: deferred.resolver,
            availableFonts: ["SlowClose"],
            onNewFontUsed,
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

    expect(onNewFontUsed).not.toHaveBeenCalled();
    expect(window.h.state.currentItemFontFamily).not.toBe("provider:SlowClose");
  });

  it("notifies the resolving provider when a searched font is added", async () => {
    const onNewFontUsed = vi.fn();
    const otherOnNewFontUsed = vi.fn();
    const { queryByTestId } = await render(
      <Excalidraw
        handleKeyboardGlobally={true}
        fontProviders={{
          absent: {
            icon: <span />,
            resolve: vi.fn<FontResolver>().mockRejectedValue(new Error("no")),
            availableFonts: [],
            onNewFontUsed: otherOnNewFontUsed,
          },
          provider: {
            icon: <span />,
            resolve: vi
              .fn<FontResolver>()
              .mockResolvedValue({ fontFaces, metadata }),
            availableFonts: [],
            onNewFontUsed,
          },
        }}
      />,
    );

    Keyboard.keyPress(KEYS.T);
    // the "absent" provider rejects while the picker opens - let that settle
    // inside `act`, or it lands as an unwrapped state update mid-test
    await act(async () => {
      fireEvent.click(queryByTestId("font-family-show-fonts")!);
    });
    const input = document.querySelector<HTMLInputElement>(
      ".properties-content .QuickSearch__input",
    )!;
    await act(async () => {
      fireEvent.input(input, { target: { value: "Announced" } });
    });

    await act(async () => {
      fireEvent.click(
        (await screen.findByText("Announced")).closest("button")!,
      );
    });

    expect(onNewFontUsed).toHaveBeenCalledTimes(1);
    expect(onNewFontUsed).toHaveBeenCalledWith("Announced");
    // the provider that couldn't resolve it is not told about it
    expect(otherOnNewFontUsed).not.toHaveBeenCalled();
    expect(window.h.state.currentItemFontFamily).toBe("provider:Announced");
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
          provider: {
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
      'button[value="provider:Broken"]',
    )!;
    fireEvent.mouseMove(failedButton);
    await waitFor(() =>
      expect(
        document.querySelector('button[value="provider:Broken"]'),
      ).toHaveClass("dropdown-menu-item--hovered"),
    );

    const buttons = Array.from(
      document.querySelectorAll<HTMLButtonElement>(
        ".properties-content .dropdown-menu.fonts button[value]",
      ),
    );
    const failedIndex = buttons.findIndex(
      (button) => button.value === "provider:Broken",
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
          provider: {
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
      expect(API.getElement(text).fontFamily).toBe("provider:Tall"),
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

    expect(API.getElement(text).fontFamily).toBe("provider:Tall");
    expect(API.getElement(text).width).toBe(selectedGeometry.width);
    expect(API.getElement(text).height).toBe(selectedGeometry.height);
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
            provider: {
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

      expect(API.getElement(text).fontFamily).toBe("provider:Deferred");
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
      provider: {
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
      rerender(<Excalidraw fontProviders={providers("added")} />);
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
          provider: {
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
      fontFamily: "provider:CollabArrived",
    });
    API.setElements([text]);
    act(() => {
      Fonts.registerCustomFont("provider:CollabArrived", metadata, {
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
          provider: {
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
        Fonts.registerCustomFont("provider:DuringPreview", metadata, {
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
    // element - reopening the picker must still list it (the transient
    // `newSceneFamilies` state died with the previous popup)
    const { queryByTestId } = await render(
      <Excalidraw
        handleKeyboardGlobally={true}
        fontProviders={{
          provider: {
            icon: <span />,
            resolve: vi.fn<FontResolver>(),
            availableFonts: [],
          },
        }}
      />,
    );

    API.setAppState({ currentItemFontFamily: "provider:Orphaned" });

    Keyboard.keyPress(KEYS.T);
    fireEvent.click(queryByTestId("font-family-show-fonts")!);

    expect(await screen.findByText("Orphaned")).toBeInTheDocument();
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
            provider: {
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
        expect(API.getElement(text).fontFamily).toBe("provider:StaleHover"),
      );

      // preview again and leave - the reset must restore the retried family,
      // not the pre-retry snapshot
      fireEvent.mouseMove(findBuiltinRow());
      await waitFor(() =>
        expect(API.getElement(text).fontFamily).not.toBe("provider:StaleHover"),
      );
      fireEvent.pointerLeave(document.querySelector(".properties-content")!);

      await waitFor(() =>
        expect(API.getElement(text).fontFamily).toBe("provider:StaleHover"),
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
            provider: {
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
        expect(API.getElement(text).fontFamily).toBe("provider:SupersededFast"),
      );

      // the superseded resolution settling later cannot override it
      await act(async () => {
        resolveSlow({ fontFaces, metadata });
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
      expect(API.getElement(text).fontFamily).toBe("provider:SupersededFast");
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
        font.includes("HoverHeal")
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
            provider: {
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
        expect(API.getElement(text).fontFamily).toBe("provider:HoverHeal"),
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
        expect(API.getElement(text).fontFamily).not.toBe("provider:HoverHeal"),
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
        expect(API.getElement(text).fontFamily).toBe("provider:HoverHeal"),
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

    it("lists the first matches, selecting one announces it", async () => {
      vi.spyOn(document.fonts, "check").mockReturnValue(false);
      vi.spyOn(document.fonts, "load").mockResolvedValue([]);
      const onNewFontUsed = vi.fn();
      const names = Array.from({ length: 12 }, (_, i) => `Sans ${i}`);
      await openAndSearch(
        {
          provider: {
            icon: <span />,
            resolve,
            availableFonts: ["Sans 0"],
            search: async () => ({ kind: "match", names }),
            onNewFontUsed,
          },
        },
        "sans",
      );

      expect(await screen.findByText("Search results")).not.toBeNull();
      // "Sans 0" is listed already, so 11 left - 10 shown
      expect(rowValues()).toEqual([
        "provider:Sans 0",
        ...names.slice(1, 11).map((name) => `provider:${name}`),
      ]);
      expect(screen.getByText("+1 more, keep typing to narrow")).not.toBeNull();

      await act(async () => {
        fireEvent.click(screen.getByText("Sans 3").closest("button")!);
      });

      expect(window.h.state.currentItemFontFamily).toBe("provider:Sans 3");
      expect(onNewFontUsed).toHaveBeenCalledWith("Sans 3");
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
          fuzzy: {
            icon: <span />,
            resolve: fuzzyResolve,
            availableFonts: [],
            search: async () => ({ kind: "suggestion", names: ["Roboto"] }),
          },
        },
        "rovoto",
      );

      expect(await screen.findByText("Did you mean…")).not.toBeNull();
      // the provider searched already - no point offering the typed name
      expect(screen.queryByText("rovoto")).toBeNull();
      expect(rowValues()).toEqual(["fuzzy:Roboto"]);

      await pressEnter();

      expect(fuzzyResolve).not.toHaveBeenCalled();
    });

    it("tries the typed name only with providers that couldn't search", async () => {
      const plainResolve = vi
        .fn<FontResolver>()
        .mockRejectedValue(new Error("no"));
      const brokenResolve = vi
        .fn<FontResolver>()
        .mockRejectedValue(new Error("no"));
      const fuzzyResolve = vi.fn<FontResolver>(resolve);
      await openAndSearch(
        {
          plain: { icon: <span />, resolve: plainResolve, availableFonts: [] },
          broken: {
            icon: <span />,
            resolve: brokenResolve,
            availableFonts: [],
            search: async () => {
              throw new Error("offline");
            },
          },
          fuzzy: {
            icon: <span />,
            resolve: fuzzyResolve,
            availableFonts: [],
            search: async () => ({ kind: "suggestion", names: ["Roboto"] }),
          },
        },
        "rovoto",
      );

      await screen.findByText("Did you mean…");
      expect(screen.getByText("rovoto")).not.toBeNull();

      await pressEnter();

      await waitFor(() => expect(brokenResolve).toHaveBeenCalledWith("rovoto"));
      expect(plainResolve).toHaveBeenCalledWith("rovoto");
      expect(fuzzyResolve).not.toHaveBeenCalled();
    });

    it("shows a pending search as such", async () => {
      await openAndSearch(
        {
          provider: {
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

    it("doesn't announce a suggested font that's already offered", async () => {
      vi.spyOn(document.fonts, "check").mockReturnValue(false);
      vi.spyOn(document.fonts, "load").mockResolvedValue([]);
      const onNewFontUsed = vi.fn();
      await openAndSearch(
        {
          provider: {
            icon: <span />,
            resolve,
            availableFonts: ["Roboto"],
            search: async () => ({ kind: "suggestion", names: ["Roboto"] }),
            onNewFontUsed,
          },
        },
        "rovoto",
      );

      await screen.findByText("Did you mean…");
      await act(async () => {
        fireEvent.click(screen.getByText("Roboto").closest("button")!);
      });

      expect(window.h.state.currentItemFontFamily).toBe("provider:Roboto");
      expect(onNewFontUsed).not.toHaveBeenCalled();
    });

    it("doesn't announce a searched font that's listed already", async () => {
      vi.spyOn(document.fonts, "check").mockReturnValue(false);
      vi.spyOn(document.fonts, "load").mockResolvedValue([]);
      const onNewFontUsed = vi.fn();
      await openAndSearch(
        {
          provider: {
            icon: <span />,
            resolve,
            availableFonts: [],
            search: async () => ({
              kind: "match",
              names: ["Lobster", "Lobster Two"],
            }),
            onNewFontUsed,
          },
        },
        "lob",
        [
          API.createElement({
            type: "text",
            text: "Hello",
            fontFamily: "provider:Lobster",
          }),
        ],
      );

      await screen.findByText("Lobster Two");
      expect(rowValues()).toEqual(["provider:Lobster", "provider:Lobster Two"]);
      await act(async () => {
        fireEvent.click(screen.getByText("Lobster").closest("button")!);
      });

      expect(onNewFontUsed).not.toHaveBeenCalled();
    });

    it("keeps focus in the popup after a keep-open selection while editing", async () => {
      vi.spyOn(document.fonts, "check").mockReturnValue(false);
      vi.spyOn(document.fonts, "load").mockResolvedValue([]);
      const { queryByTestId } = await render(
        <Excalidraw
          handleKeyboardGlobally={true}
          fontProviders={{
            provider: { icon: <span />, resolve, availableFonts: [] },
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
      await pressEnter();

      await waitFor(() =>
        expect(h.state.currentItemFontFamily).toBe("provider:Foo"),
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
        search: async () => ({ kind: "match", names: familyNames }),
      });
      await openAndSearch(
        {
          big: provider(names("Big", 25)),
          small: provider(names("Small", 3)),
        },
        "sans",
      );

      await screen.findByText("Search results");
      // the short list's unused slots go to the long one, order kept
      expect(rowValues()).toEqual([
        ...names("Big", 7).map((name) => `big:${name}`),
        ...names("Small", 3).map((name) => `small:${name}`),
      ]);
      expect(
        screen.getByText("+18 more, keep typing to narrow"),
      ).not.toBeNull();
    });

    it("drops suggestions while another provider matches", async () => {
      await openAndSearch(
        {
          fuzzy: {
            icon: <span />,
            resolve,
            availableFonts: [],
            search: async () => ({ kind: "suggestion", names: ["Lobster"] }),
          },
          exact: {
            icon: <span />,
            resolve,
            availableFonts: [],
            search: async () => ({ kind: "match", names: ["Lobster Two"] }),
          },
        },
        "lobster t",
      );

      await screen.findByText("Search results");
      expect(rowValues()).toEqual(["exact:Lobster Two"]);
      expect(screen.queryByText("Did you mean…")).toBeNull();
    });

    it("aborts a superseded search", async () => {
      const signals: AbortSignal[] = [];
      const input = await openAndSearch(
        {
          provider: {
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

    const openFontPicker = async () => {
      const utils = await render(<Excalidraw handleKeyboardGlobally={true} />);
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
            provider: {
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
          "provider:Pinned",
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
      expect(h.state.currentItemFontFamily).not.toBe("provider:Pinned");
      await act(async () => deferred.resolve());
      await waitFor(() =>
        expect(h.state.currentItemFontFamily).toBe("provider:Pinned"),
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

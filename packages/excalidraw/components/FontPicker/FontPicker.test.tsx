import { fireEvent, screen, waitFor } from "@testing-library/react";

import { KEYS } from "@excalidraw/common";
import { Scene } from "@excalidraw/element";

import type { FontMetadata } from "@excalidraw/common";

import { Excalidraw } from "../../index";
import { Fonts } from "../../fonts";
import { API } from "../../tests/helpers/api";
import { muteExpectedFontErrors } from "../../tests/helpers/mocks";
import { Keyboard } from "../../tests/helpers/ui";
import { act, cleanup, render } from "../../tests/test-utils";

import type { FontResolver } from "../../fonts";

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
    const fonts = window.h.app.fonts;

    // fresh object, same keys - contractually interchangeable
    rerender(<Excalidraw fontProviders={providers()} />);
    expect(window.h.app.fonts).toBe(fonts);

    // an added key is the one realistic change - swap
    rerender(<Excalidraw fontProviders={providers("added")} />);
    await waitFor(() => expect(window.h.app.fonts).not.toBe(fonts));
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
      const fontsBefore = window.h.app.fonts;
      rerender(<Excalidraw fontProviders={providers("added")} />);
      await waitFor(() => expect(window.h.app.fonts).not.toBe(fontsBefore));

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
});

import rough from "roughjs/bin/rough";

import {
  elementWithCanvasCache,
  renderElement,
  Scene,
  syncInvalidIndices,
} from "@excalidraw/element";

import {
  arrayToMap,
  createProviderFontFamily,
  FONT_FAMILY,
  getCustomFontCSSFamily,
  getFontString,
  isFontMetadataAvailable,
  parseProviderFontFamily,
} from "@excalidraw/common";

import type { CustomFontFamily, FontMetadata } from "@excalidraw/common";

import type {
  ExcalidrawTextElement,
  NonDeletedSceneElementsMap,
} from "@excalidraw/element/types";

import { getDefaultAppState } from "../appState";
import { AppFonts } from "../components/App.fonts";
import { defaultFontRegistry, FontRegistry, Fonts } from "../fonts";
import { ExcalidrawFontFace } from "../fonts/ExcalidrawFontFace";

import { API } from "./helpers/api";
import { muteExpectedFontErrors } from "./helpers/mocks";

import type App from "../components/App";
import type { FontResolver } from "../fonts";
import type {
  RenderableElementsMap,
  StaticCanvasRenderConfig,
} from "../scene/types";
import type { AppState } from "../types";

const METADATA: FontMetadata = {
  metrics: {
    unitsPerEm: 1000,
    ascender: 800,
    descender: -200,
    lineHeight: 1.2,
  },
};

const FONT_FACES = [{ uri: "https://example.com/font.woff2" }] as const;

let counter = 0;

/**
 * A family no other test has used.
 *
 * `Fonts.registered` is page-global and deliberately never torn down, so tests
 * which register would otherwise leak into each other.
 */
const uniqueFamily = (): CustomFontFamily => `test.test:Roboto-${counter++}`;

describe("provider-qualified font families", () => {
  it("creates and parses provider-qualified family ids", () => {
    const family = createProviderFontFamily("test.provider", "Font:Variant");

    expect(family).toBe("test.provider:Font:Variant");
    expect(parseProviderFontFamily(family)).toEqual({
      providerId: "test.provider",
      familyName: "Font:Variant",
    });
    expect(parseProviderFontFamily("Font")).toBeNull();
    expect(parseProviderFontFamily(":Font")).toBeNull();
  });

  it("only accepts `google` or a reverse-DNS provider key", () => {
    const create = (key: string) => () =>
      new Fonts(new Scene(), { [key]: vi.fn() });

    expect(create("google")).not.toThrow();
    expect(create("com.acme.fonts")).not.toThrow();
    expect(create("fonts.acme-corp.io")).not.toThrow();

    for (const key of [
      "",
      // dotless keys other than `google` are reserved for us
      "acme",
      "excalidraw",
      // part of the id's own syntax
      "bad:key",
      "com.acme:fonts",
      // "Google" next to "google" would read as one provider, but be two
      "Google",
      "com.Acme.fonts",
      "com..acme",
      ".com.acme",
      "com.acme.",
      "com.acme fonts",
    ]) {
      expect(create(key)).toThrow("Invalid font provider key");
    }
  });
});

describe("custom font registration", () => {
  beforeEach(() => {
    // several tests below reject on purpose - keep the expected log out of the
    // test output, without muting anything else
    muteExpectedFontErrors();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reports unsupported families without tracking them as failures", async () => {
    const fonts = new Fonts(new Scene());

    await expect(
      fonts.registerCustomFamilies(["test.missing:Font"]),
    ).resolves.toEqual([
      {
        family: "test.missing:Font",
        status: "unsupported",
      },
    ]);
    expect(fonts.failedResolutions.has("test.missing:Font")).toBe(false);
  });

  it("tracks resolver failures and clears them after a successful retry", async () => {
    const failure = new Error("temporary failure");
    const resolve = vi
      .fn()
      .mockRejectedValueOnce(failure)
      .mockResolvedValueOnce({ fontFaces: FONT_FACES, metadata: METADATA });
    const fonts = new Fonts(new Scene(), { "test.retry": resolve });
    const initialRegisteredFonts = fonts.registered;
    const onRegisteredFontsChange = vi.fn();
    const unsubscribe = fonts.onRegisteredFontsChangeEmitter.on(
      onRegisteredFontsChange,
    );

    await expect(
      fonts.registerCustomFamilies(["test.retry:Font"]),
    ).resolves.toEqual([
      {
        family: "test.retry:Font",
        status: "failed",
      },
    ]);
    expect(fonts.failedResolutions.has("test.retry:Font")).toBe(true);
    // the rejection is retained, i.e. for debugging
    expect(fonts.failedResolutions.get("test.retry:Font")).toBe(failure);
    expect(fonts.registered).toBe(initialRegisteredFonts);
    expect(onRegisteredFontsChange).not.toHaveBeenCalled();

    await expect(
      fonts.registerCustomFamilies(["test.retry:Font"]),
    ).resolves.toEqual([
      {
        family: "test.retry:Font",
        status: "success",
      },
    ]);
    expect(fonts.failedResolutions.has("test.retry:Font")).toBe(false);
    expect(fonts.registered.has("test.retry:Font")).toBe(true);
    expect(fonts.registered).not.toBe(initialRegisteredFonts);
    expect(onRegisteredFontsChange).toHaveBeenCalledWith(fonts.registered);
    unsubscribe();
  });

  it("emits one registry update after bulk registration settles", async () => {
    const fonts = new Fonts(new Scene(), {
      "test.bulk": vi.fn().mockResolvedValue({
        fontFaces: FONT_FACES,
        metadata: METADATA,
      }),
    });
    const onRegisteredFontsChange = vi.fn();
    const unsubscribe = fonts.onRegisteredFontsChangeEmitter.on(
      onRegisteredFontsChange,
    );

    await expect(
      fonts.registerCustomFamilies(["test.bulk:First", "test.bulk:Second"]),
    ).resolves.toEqual([
      { family: "test.bulk:First", status: "success" },
      { family: "test.bulk:Second", status: "success" },
    ]);

    expect(onRegisteredFontsChange).toHaveBeenCalledTimes(1);
    expect(onRegisteredFontsChange).toHaveBeenCalledWith(fonts.registered);
    unsubscribe();
  });

  it("announces a registration even while a batch-mate is still resolving", async () => {
    let resolveSlow!: (font: Awaited<ReturnType<FontResolver>>) => void;
    const resolve = vi.fn().mockImplementation((name: string) =>
      name === "Slow"
        ? new Promise<Awaited<ReturnType<FontResolver>>>((r) => {
            resolveSlow = r;
          })
        : Promise.resolve({ fontFaces: FONT_FACES, metadata: METADATA }),
    );
    const fonts = new Fonts(new Scene(), { "test.mixed": resolve });
    const onRegisteredFontsChange = vi.fn();
    const unsubscribe = fonts.onRegisteredFontsChangeEmitter.on(
      onRegisteredFontsChange,
    );

    const batch = fonts.registerCustomFamilies([
      "test.mixed:Fast",
      "test.mixed:Slow",
    ]);

    // a slow (or hanging) batch-mate must not mute Fast's announcement -
    // pickers and other editors key their state off this emit
    await vi.waitFor(() => {
      expect(fonts.registered.has("test.mixed:Fast")).toBe(true);
      expect(onRegisteredFontsChange).toHaveBeenCalledWith(fonts.registered);
    });

    resolveSlow({ fontFaces: FONT_FACES, metadata: METADATA });
    await batch;
    unsubscribe();
  });

  it("reuses an in-flight resolution across instances", async () => {
    let resolveFont!: (font: Awaited<ReturnType<FontResolver>>) => void;
    const resolve: FontResolver = vi.fn(
      () =>
        new Promise<Awaited<ReturnType<FontResolver>>>((resolve) => {
          resolveFont = resolve;
        }),
    );
    const firstFonts = new Fonts(new Scene(), { "test.inflight": resolve });
    const secondFonts = new Fonts(new Scene(), { "test.inflight": resolve });

    const firstRegistration =
      firstFonts.registerCustomFamily("test.inflight:Font");
    const secondRegistration =
      secondFonts.registerCustomFamily("test.inflight:Font");

    // the resolver runs once its concurrency slot is granted (a microtask)
    await vi.waitFor(() => expect(resolve).toHaveBeenCalledTimes(1));
    expect(firstFonts.registered).toBe(secondFonts.registered);
    resolveFont({ fontFaces: FONT_FACES, metadata: METADATA });

    await expect(
      Promise.all([firstRegistration, secondRegistration]),
    ).resolves.toEqual([
      { family: "test.inflight:Font", status: "success" },
      { family: "test.inflight:Font", status: "success" },
    ]);
    expect(resolve).toHaveBeenCalledTimes(1);
  });

  it("registers additional families while loading scene fonts", async () => {
    const resolve = vi
      .fn()
      .mockResolvedValue({ fontFaces: FONT_FACES, metadata: METADATA });
    const fonts = new Fonts(new Scene(), { "test.scene": resolve });

    await fonts.loadSceneFonts(["test.scene:Current"]);

    expect(resolve).toHaveBeenCalledWith("Current");
    expect(fonts.registered.has("test.scene:Current")).toBe(true);
  });

  it("loads families even when `document.fonts.check` passes", async () => {
    // Chrome's `check()` passes for any family matching an installed system
    // font (i.e. a locally installed Excalifont), with its web faces unloaded
    const check = vi.spyOn(document.fonts, "check").mockReturnValue(true);
    const load = vi.spyOn(document.fonts, "load").mockResolvedValue([]);

    try {
      await new Fonts(new Scene()).loadSceneFonts([FONT_FAMILY.Excalifont]);

      expect(load).toHaveBeenCalledWith(
        expect.stringContaining("Excalifont"),
        expect.anything(),
      );
    } finally {
      check.mockRestore();
      load.mockRestore();
    }
  });

  it("loads already-resolved families without waiting on pending resolvers", async () => {
    const check = vi.spyOn(document.fonts, "check").mockReturnValue(false);
    const load = vi.spyOn(document.fonts, "load").mockResolvedValue([]);
    let resolveFont!: (font: Awaited<ReturnType<FontResolver>>) => void;
    const fonts = new Fonts(new Scene(), {
      "test.pending": vi.fn(
        () =>
          new Promise<Awaited<ReturnType<FontResolver>>>((resolve) => {
            resolveFont = resolve;
          }),
      ),
    });

    try {
      const loading = fonts.loadSceneFonts([
        FONT_FAMILY.Excalifont,
        "test.pending:Font",
      ]);

      // a resolver that never settles must not hold back the built-in font
      await vi.waitFor(() =>
        expect(load).toHaveBeenCalledWith(
          expect.stringContaining("Excalifont"),
          expect.anything(),
        ),
      );
      expect(fonts.registered.has("test.pending:Font")).toBe(false);

      await vi.waitFor(() => expect(resolveFont).toBeDefined());
      resolveFont({ fontFaces: FONT_FACES, metadata: METADATA });
      await loading;

      expect(fonts.registered.has("test.pending:Font")).toBe(true);
    } finally {
      check.mockRestore();
      load.mockRestore();
    }
  });

  it("leaves the font faces unbuilt where there is no font set (headless export)", async () => {
    // jsdom implements no `document.fonts`; only the test document is mocked
    vi.stubGlobal("document", document.implementation.createHTMLDocument());
    try {
      // building the built-in faces takes `FontFace`, which such an
      // environment needn't have
      const registry = new FontRegistry();
      const registered = vi.spyOn(registry, "registered", "get");
      const text = API.createElement({
        type: "text",
        text: "hi",
        fontFamily: FONT_FAMILY.Helvetica,
      });

      expect(
        await Fonts.loadElementsFonts(
          [text],
          new Fonts(new Scene(), {}, registry),
        ),
      ).toEqual([]);
      expect(registered).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("loads into a document passed in place of a `Fonts`", async () => {
    const ownerDocument = document.implementation.createHTMLDocument();
    const load = vi.fn(async () => []);
    Object.defineProperty(ownerDocument, "fonts", {
      value: { has: () => true, add: vi.fn(), check: () => false, load },
    });

    await Fonts.loadElementsFonts(
      [API.createElement({ type: "text", text: "hi" })],
      ownerDocument,
    );

    expect(load).toHaveBeenCalled();
  });

  it("keeps registered custom families loadable", async () => {
    const fonts = new Fonts(new Scene(), {
      "test.loadable": vi
        .fn()
        .mockResolvedValue({ fontFaces: FONT_FACES, metadata: METADATA }),
    });

    expect(fonts.shouldLoadCustomFamily("test.loadable:Font")).toBe(true);

    await fonts.registerCustomFamily("test.loadable:Font");

    // registering only installs the font faces - they still need loading
    expect(fonts.registered.has("test.loadable:Font")).toBe(true);
    expect(fonts.shouldLoadCustomFamily("test.loadable:Font")).toBe(true);
    expect(fonts.shouldLoadCustomFamily(FONT_FAMILY.Excalifont)).toBe(false);
  });

  it("treats a malformed resolver definition as a failure", async () => {
    const resolve = vi.fn().mockResolvedValue({
      fontFaces: [],
      metadata: METADATA,
    });
    const fonts = new Fonts(new Scene(), { "test.malformed": resolve });

    // garbage reported as success would crash metric consumers much later
    await expect(
      fonts.registerCustomFamily("test.malformed:Font"),
    ).resolves.toEqual({ family: "test.malformed:Font", status: "failed" });
    expect(fonts.failedResolutions.has("test.malformed:Font")).toBe(true);
    expect(fonts.registered.has("test.malformed:Font")).toBe(false);
  });

  it("caps concurrent resolver invocations registry-wide", async () => {
    let active = 0;
    let maxActive = 0;
    const resolve = vi.fn().mockImplementation(async () => {
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active--;
      return { fontFaces: FONT_FACES, metadata: METADATA };
    });
    const fonts = new Fonts(new Scene(), { "test.capped": resolve });

    const families = Array.from(
      { length: 12 },
      (_, index): CustomFontFamily => `test.capped:Font-${index}`,
    );
    const results = await fonts.registerCustomFamilies(families);

    expect(results.every((result) => result.status === "success")).toBe(true);
    expect(resolve).toHaveBeenCalledTimes(12);
    // same-family dedup can't help distinct families - the queue must
    expect(maxActive).toBeLessThanOrEqual(6);
    expect(maxActive).toBeGreaterThan(1);
  });

  it("does not treat inherited object members as providers", async () => {
    const fonts = new Fonts(new Scene(), {
      "test.real": vi
        .fn()
        .mockResolvedValue({ fontFaces: FONT_FACES, metadata: METADATA }),
    });

    // "toString" exists on Object.prototype - it must not pass as a resolver
    expect(fonts.shouldLoadCustomFamily("toString:Foo")).toBe(false);
    expect(await fonts.registerCustomFamily("toString:Foo")).toEqual({
      family: "toString:Foo",
      status: "unsupported",
    });
  });

  it("shares resolution failures across instances", async () => {
    const resolve = vi.fn().mockRejectedValue(new Error("unavailable"));
    const first = new Fonts(new Scene(), { "test.sharedfailure": resolve });
    const second = new Fonts(new Scene(), { "test.sharedfailure": resolve });
    const onFailedResolutionsChange = vi.fn();
    const unsubscribe = second.onFailedResolutionsChangeEmitter.on(
      onFailedResolutionsChange,
    );

    await first.registerCustomFamily("test.sharedfailure:Font");

    // page-scoped, like the registry it guards
    expect(second.failedResolutions.has("test.sharedfailure:Font")).toBe(true);
    expect(second.shouldLoadCustomFamily("test.sharedfailure:Font")).toBe(
      false,
    );
    expect(onFailedResolutionsChange).toHaveBeenCalledWith(
      second.failedResolutions,
    );
    unsubscribe();
  });

  it("does not record failures for headless element registration", async () => {
    const resolve = vi.fn().mockRejectedValue(new Error("offline"));
    const fonts = new Fonts(new Scene(), { "test.headless": resolve });

    await fonts.registerCustomFamilies(["test.headless:Font"], {
      recordFailure: false,
    });

    expect(resolve).toHaveBeenCalledTimes(1);
    expect(fonts.failedResolutions.has("test.headless:Font")).toBe(false);
  });

  it("does not let a speculative attempt clear a recorded failure", async () => {
    const resolve = vi.fn().mockRejectedValue(new Error("down"));
    const fonts = new Fonts(new Scene(), { "test.probe": resolve });

    await fonts.registerCustomFamily("test.probe:Font");
    expect(fonts.failedResolutions.has("test.probe:Font")).toBe(true);

    // i.e. a search probing this provider, or a headless export - failing
    // without recording must leave the recorded verdict untouched, or the
    // family would silently re-enter automatic loading
    await fonts.registerCustomFamily("test.probe:Font", {
      recordFailure: false,
    });
    expect(fonts.failedResolutions.has("test.probe:Font")).toBe(true);
    expect(fonts.shouldLoadCustomFamily("test.probe:Font")).toBe(false);
  });

  it("clears a recorded failure when the family resolves, even speculatively", async () => {
    const resolve = vi
      .fn()
      .mockRejectedValueOnce(new Error("down"))
      .mockResolvedValue({ fontFaces: FONT_FACES, metadata: METADATA });
    const fonts = new Fonts(new Scene(), { "test.probeclear": resolve });

    await fonts.registerCustomFamily("test.probeclear:Font");
    expect(fonts.failedResolutions.has("test.probeclear:Font")).toBe(true);

    // the definition is registered page-wide at that point, so there is
    // nothing left to be failed about
    await fonts.registerCustomFamily("test.probeclear:Font", {
      recordFailure: false,
    });
    expect(fonts.failedResolutions.has("test.probeclear:Font")).toBe(false);
    expect(fonts.registered.has("test.probeclear:Font")).toBe(true);
  });

  it("does not track speculative resolution failures", async () => {
    const resolve = vi.fn().mockRejectedValue(new Error("not carried"));
    const fonts = new Fonts(new Scene(), { "test.speculative": resolve });

    await expect(
      fonts.registerCustomFamily("test.speculative:Font", {
        recordFailure: false,
      }),
    ).resolves.toEqual({ family: "test.speculative:Font", status: "failed" });
    expect(fonts.failedResolutions.has("test.speculative:Font")).toBe(false);

    await expect(
      fonts.registerCustomFamily("test.speculative:Font"),
    ).resolves.toEqual({ family: "test.speculative:Font", status: "failed" });
    expect(fonts.failedResolutions.has("test.speculative:Font")).toBe(true);
  });

  it("only retries failed automatic loads when explicitly requested", async () => {
    const resolve = vi.fn().mockRejectedValue(new Error("unavailable"));
    const fonts = new Fonts(new Scene(), { "test.automatic": resolve });

    await fonts.loadSceneFonts(["test.automatic:Font"]);
    await fonts.loadSceneFonts(["test.automatic:Font"]);
    expect(resolve).toHaveBeenCalledTimes(1);

    await fonts.registerCustomFamily("test.automatic:Font");
    expect(resolve).toHaveBeenCalledTimes(2);
  });

  it("only marks resolvable missing definitions as loadable", async () => {
    const resolve = vi.fn().mockRejectedValue(new Error("unavailable"));
    const fonts = new Fonts(new Scene(), { "test.actionable": resolve });

    expect(fonts.shouldLoadCustomFamily("test.actionable:Font")).toBe(true);
    expect(fonts.shouldLoadCustomFamily("test.missing:Font")).toBe(false);
    expect(fonts.shouldLoadCustomFamily(FONT_FAMILY.Assistant)).toBe(false);

    await fonts.registerCustomFamily("test.actionable:Font");
    expect(fonts.shouldLoadCustomFamily("test.actionable:Font")).toBe(false);
  });

  it("reuses a resolved definition without a resolver", async () => {
    const resolve = vi
      .fn()
      .mockResolvedValue({ fontFaces: FONT_FACES, metadata: METADATA });
    const resolvingFonts = new Fonts(new Scene(), { "test.shared": resolve });
    const resolverlessFonts = new Fonts(new Scene());

    await expect(
      resolvingFonts.registerCustomFamily("test.shared:Font"),
    ).resolves.toEqual({ family: "test.shared:Font", status: "success" });
    await expect(
      resolverlessFonts.registerCustomFamily("test.shared:Font"),
    ).resolves.toEqual({ family: "test.shared:Font", status: "success" });

    expect(resolve).toHaveBeenCalledTimes(1);
    expect(resolverlessFonts.registered.has("test.shared:Font")).toBe(true);
  });

  it("logs resource-load failures for custom families", async () => {
    const loadError = new Error("network failure");
    const check = vi.spyOn(document.fonts, "check").mockReturnValue(false);
    const load = vi.spyOn(document.fonts, "load").mockRejectedValue(loadError);
    const fonts = new Fonts(new Scene(), {
      "test.resource": vi.fn().mockResolvedValue({
        fontFaces: [{ uri: "https://example.com/font.woff2" }],
        metadata: METADATA,
      }),
    });

    try {
      await fonts.loadSceneFonts(["test.resource:Font"]);

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining("https://example.com/font.woff2"),
        loadError,
      );
    } finally {
      check.mockRestore();
      load.mockRestore();
    }
  });

  it("keeps a custom registry isolated from the page default", async () => {
    const family = uniqueFamily();
    const resolve = vi
      .fn()
      .mockResolvedValue({ fontFaces: FONT_FACES, metadata: METADATA });
    const isolated = new Fonts(
      new Scene(),
      { "test.test": resolve },
      new FontRegistry(),
    );

    await expect(isolated.registerCustomFamily(family)).resolves.toEqual({
      family,
      status: "success",
    });

    expect(isolated.registered.has(family)).toBe(true);
    // neither the default registry nor editors on it see the family
    expect(Fonts.registered.has(family)).toBe(false);
    expect(new Fonts(new Scene()).registered.has(family)).toBe(false);
  });

  it("does not mutate element indices when loading fonts", async () => {
    const text = API.createElement({
      type: "text",
      text: "export",
      index: null,
    });
    const version = text.version;
    const versionNonce = text.versionNonce;

    await Fonts.loadElementsFonts([text]);

    expect(text.index).toBeNull();
    expect(text.version).toBe(version);
    expect(text.versionNonce).toBe(versionNonce);
  });

  it("loads already-resolved families without waiting on pending resolvers", async () => {
    const check = vi.spyOn(document.fonts, "check").mockReturnValue(false);
    const load = vi.spyOn(document.fonts, "load").mockResolvedValue([]);
    let resolveFont!: (font: Awaited<ReturnType<FontResolver>>) => void;
    const fonts = new Fonts(new Scene(), {
      "test.pendingelements": vi.fn(
        () =>
          new Promise<Awaited<ReturnType<FontResolver>>>((resolve) => {
            resolveFont = resolve;
          }),
      ),
    });

    try {
      const builtin = API.createElement({ type: "text", text: "a" });
      const custom = API.createElement({
        type: "text",
        text: "b",
        fontFamily: "test.pendingelements:Font",
      });
      const loading = Fonts.loadElementsFonts([builtin, custom], fonts);

      // pasted built-in text must not wait for a resolver to settle
      await vi.waitFor(() =>
        expect(load).toHaveBeenCalledWith(
          expect.stringContaining("Excalifont"),
          expect.anything(),
        ),
      );
      expect(fonts.registered.has("test.pendingelements:Font")).toBe(false);

      await vi.waitFor(() => expect(resolveFont).toBeDefined());
      resolveFont({ fontFaces: FONT_FACES, metadata: METADATA });
      await loading;

      expect(fonts.registered.has("test.pendingelements:Font")).toBe(true);
    } finally {
      check.mockRestore();
      load.mockRestore();
    }
  });

  it("retries a page-failed family when not recording failures (i.e. exports)", async () => {
    const resolve = vi
      .fn()
      .mockRejectedValueOnce(new Error("transient"))
      .mockResolvedValue({
        fontFaces: [{ uri: "https://example.com/font.woff2" }],
        metadata: METADATA,
      });
    const fonts = new Fonts(new Scene(), { "test.exportretry": resolve });

    // an accountable attempt records the failure
    await fonts.registerCustomFamily("test.exportretry:Font");
    expect(fonts.failedResolutions.has("test.exportretry:Font")).toBe(true);

    const text = API.createElement({
      type: "text",
      text: "a",
      fontFamily: "test.exportretry:Font",
    });

    // a failure-recording load keeps respecting the verdict
    await Fonts.loadElementsFonts([text], fonts);
    expect(resolve).toHaveBeenCalledTimes(1);

    // the export path (recordFailure: false) retries and recovers
    await Fonts.loadElementsFonts([text], fonts, { recordFailure: false });
    expect(resolve).toHaveBeenCalledTimes(2);
    expect(fonts.registered.has("test.exportretry:Font")).toBe(true);
  });
});

describe("Fonts.warnAboutUnresolvableFonts", () => {
  it("warns once about a family no resolver or registration covers", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const registered = uniqueFamily();
    Fonts.registerCustomFont(registered, METADATA, FONT_FACES[0]);

    const elements = [
      "com.unresolvable:Font",
      // covered by a resolver, by the page's registry, or built in
      "test.covered:Font",
      registered,
      FONT_FAMILY.Excalifont,
      // not an id a provider could have written
      "Comic Sans MS",
    ].map((fontFamily) =>
      API.createElement({
        type: "text",
        text: "a",
        fontFamily: fontFamily as CustomFontFamily,
      }),
    );
    const fonts = new Fonts(new Scene(), { "test.covered": vi.fn() });

    Fonts.warnAboutUnresolvableFonts(elements, fonts);
    Fonts.warnAboutUnresolvableFonts(elements, fonts);

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('"com.unresolvable:Font"');
    warn.mockRestore();
  });
});

describe("Fonts.warnAboutUnresolvableFonts (headless)", () => {
  it("leaves the font faces unbuilt", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    // building the built-in faces takes `FontFace`, which an environment
    // without a font set needn't have
    const registry = new FontRegistry();
    const registered = vi.spyOn(registry, "registered", "get");

    Fonts.warnAboutUnresolvableFonts(
      [
        API.createElement({
          type: "text",
          text: "a",
          fontFamily: "test.unconfigured:Brand",
        }),
      ],
      new Fonts(new Scene(), {}, registry),
    );

    expect(registered).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});

describe("Fonts.registerCustomFont", () => {
  it("rejects a family which is not provider-qualified", () => {
    // runtime data may lie about its type - javascript hosts aren't bound by it
    const bare = "Roboto" as CustomFontFamily;

    expect(() =>
      Fonts.registerCustomFont(bare, METADATA, FONT_FACES[0]),
    ).toThrow(/provider-qualified/);
    expect(Fonts.registered.has(bare)).toBe(false);
  });

  it("registers a provider-qualified family and notifies subscribers", () => {
    const family = uniqueFamily();
    const fonts = new Fonts(new Scene());
    const onRegisteredFontsChange = vi.fn();
    const unsubscribe = fonts.onRegisteredFontsChangeEmitter.on(
      onRegisteredFontsChange,
    );

    Fonts.registerCustomFont(family, METADATA, {
      uri: "https://example.com/font.woff2",
    });

    expect(Fonts.registered.has(family)).toBe(true);
    expect(onRegisteredFontsChange).toHaveBeenCalledWith(Fonts.registered);
    unsubscribe();
  });

  it("installs the font faces into document.fonts", () => {
    const family = uniqueFamily();
    vi.spyOn(document.fonts, "has").mockReturnValue(false);
    const add = vi.spyOn(document.fonts, "add");

    Fonts.registerCustomFont(family, METADATA, {
      uri: "https://example.com/font.woff2",
    });

    // selecting a registered family short-circuits straight to
    // `document.fonts.load`, which only loads faces already in the set
    const { fontFace } = Fonts.registered.get(family)!.fontFaces[0];
    expect(add).toHaveBeenCalledWith(fontFace);
  });

  it("publishes nothing when the registration input is malformed", () => {
    const withBadMetadata = uniqueFamily();
    const withBadFace = uniqueFamily();

    // runtime data may lie about its type - javascript hosts aren't bound by it
    const badMetadata = {
      metrics: { unitsPerEm: NaN, ascender: 0, descender: 0, lineHeight: 1 },
    } as unknown as FontMetadata;

    expect(() =>
      Fonts.registerCustomFont(withBadMetadata, badMetadata, FONT_FACES[0]),
    ).toThrow("Invalid font metadata");
    expect(() =>
      Fonts.registerCustomFont(withBadFace, METADATA, { uri: "" }),
    ).toThrow("Invalid font faces");
    // everything validates before anything publishes - no partial state
    expect(Fonts.registered.has(withBadMetadata)).toBe(false);
    expect(isFontMetadataAvailable(withBadMetadata)).toBe(false);
    expect(Fonts.registered.has(withBadFace)).toBe(false);
    expect(isFontMetadataAvailable(withBadFace)).toBe(false);
  });

  it("rejects a family with an uppercase provider key", () => {
    expect(() =>
      Fonts.registerCustomFont(
        "Test:Font" as CustomFontFamily,
        METADATA,
        FONT_FACES[0],
      ),
    ).toThrow("lowercase");
  });

  it("rejects local custom fonts", () => {
    const localMetadataFamily = uniqueFamily();
    const localDescriptorFamily = uniqueFamily();

    expect(() =>
      Fonts.registerCustomFont(
        localMetadataFamily,
        { ...METADATA, local: true },
        FONT_FACES[0],
      ),
    ).toThrow('"local" is not supported');
    expect(() =>
      Fonts.registerCustomFont(localDescriptorFamily, METADATA, {
        uri: "local:Font",
      }),
    ).toThrow("non-local");
    expect(Fonts.registered.has(localMetadataFamily)).toBe(false);
    expect(Fonts.registered.has(localDescriptorFamily)).toBe(false);
  });
});

describe("Fonts.isFamilyLoaded", () => {
  it("reports a family loaded once one of its own font faces is", () => {
    const family = uniqueFamily();

    Fonts.registerCustomFont(family, METADATA, {
      uri: "https://example.com/font.woff2",
    });

    expect(Fonts.isFamilyLoaded(family)).toBe(false);

    const { fontFace } = Fonts.registered.get(family)!.fontFaces[0];
    new Fonts(new Scene()).onLoaded([fontFace]);

    expect(Fonts.isFamilyLoaded(family)).toBe(true);
  });

  it("ignores a foreign font face of the same name", () => {
    const family = uniqueFamily();

    Fonts.registerCustomFont(family, METADATA, {
      uri: "https://example.com/font.woff2",
    });

    // same name, but not our instance (i.e. loaded by the host page itself) -
    // must stay invisible, so that callers fall back to `document.fonts.check`
    const foreign = new FontFace(
      JSON.stringify(family),
      "url(https://example.com/other.woff2)",
    );
    new Fonts(new Scene()).onLoaded([foreign]);

    expect(Fonts.isFamilyLoaded(family)).toBe(false);
  });

  it("reports an unregistered family as not loaded", () => {
    expect(Fonts.isFamilyLoaded(uniqueFamily())).toBe(false);
  });
});

describe("Fonts.retryFailedFontFaces", () => {
  it("swaps a face whose file failed to download once its family is asked for again", async () => {
    const family = uniqueFamily();
    Fonts.registerCustomFont(family, METADATA, FONT_FACES[0], {
      uri: "https://example.com/font-ext.woff2",
    });
    const [failed, fine] = Fonts.registered.get(family)!.fontFaces;
    // the browser never fetches it again
    Object.assign(failed.fontFace, { status: "error" });

    const result = await new Fonts(new Scene()).registerCustomFamily(family);

    const [retried, kept] = Fonts.registered.get(family)!.fontFaces;
    expect(result.status).toBe("success");
    expect(retried.fontFace).not.toBe(failed.fontFace);
    expect(retried.fontFace.status).toBe("unloaded");
    expect(retried.urls).toEqual(failed.urls);
    expect(kept).toBe(fine);
    // or loading the family would keep rejecting over it
    expect(document.fonts.delete).toHaveBeenCalledWith(failed.fontFace);
  });
});

describe("AppFonts.isFontBlocked", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const registerFamily = () => {
    const family = uniqueFamily();
    Fonts.registerCustomFont(family, METADATA, FONT_FACES[0]);
    return family;
  };

  /** just the parts of `App` the block needs */
  const createAppFonts = () => {
    const scene = new Scene();
    const app = {
      scene,
      props: {},
      ownerDocument: document,
      renderEnvironment: undefined,
    } as unknown as App;
    return {
      scene,
      appFonts: new AppFonts(app, { onBeforeSceneMutation: () => {} }),
    };
  };

  it("never blocks built-in or unresolvable families", () => {
    const { appFonts } = createAppFonts();

    expect(appFonts.isFontBlocked(FONT_FAMILY.Excalifont)).toBe(false);
    // no resolver for its provider - nothing to wait for
    expect(appFonts.isFontBlocked(uniqueFamily())).toBe(false);
  });

  it("blocks a loading custom family until its faces load", () => {
    const family = registerFamily();
    const { appFonts } = createAppFonts();

    expect(appFonts.isFontBlocked(family)).toBe(true);

    appFonts.instance.onLoaded([
      Fonts.registered.get(family)!.fontFaces[0].fontFace,
    ]);

    expect(appFonts.isFontBlocked(family)).toBe(false);
  });

  it("falls back for good once the block period runs out", () => {
    const family = registerFamily();
    const { scene, appFonts } = createAppFonts();
    const triggerUpdate = vi.spyOn(scene, "triggerUpdate");

    expect(appFonts.isFontBlocked(family)).toBe(true);

    vi.advanceTimersByTime(Fonts.BLOCK_PERIOD);

    // rerenders, this time drawing the fallback
    expect(triggerUpdate).toHaveBeenCalledTimes(1);
    expect(appFonts.isFontBlocked(family)).toBe(false);
  });

  it("cancels a pending fallback rerender on destroy", () => {
    const family = registerFamily();
    const { scene, appFonts } = createAppFonts();
    const triggerUpdate = vi.spyOn(scene, "triggerUpdate");

    expect(appFonts.isFontBlocked(family)).toBe(true);

    appFonts.destroy();
    vi.advanceTimersByTime(Fonts.BLOCK_PERIOD);

    expect(triggerUpdate).not.toHaveBeenCalled();
  });

  it("leaves blocked text undrawn, and uncached", () => {
    const element = API.createElement({ type: "text", text: "a" });
    const elementsMap = arrayToMap([element]);
    const canvas = document.createElement("canvas");
    const renderConfig: StaticCanvasRenderConfig = {
      imageCache: new Map(),
      renderGrid: false,
      isExporting: false,
      scale: 1,
      canvasBackgroundColor: "#fff",
      embedsValidationStatus: new Map(),
      elementsPendingErasure: new Set(),
      pendingFlowchartNodes: null,
      theme: "light",
    };
    const render = (isFontBlocked: () => boolean) =>
      renderElement(
        element,
        elementsMap as unknown as RenderableElementsMap,
        elementsMap as unknown as NonDeletedSceneElementsMap,
        rough.canvas(canvas),
        canvas.getContext("2d")!,
        { ...renderConfig, isFontBlocked },
        getDefaultAppState() as AppState,
      );

    render(() => true);
    expect(elementWithCanvasCache.has(element)).toBe(false);

    render(() => false);
    expect(elementWithCanvasCache.has(element)).toBe(true);
  });
});

describe("Fonts.mayHaveCustomFonts", () => {
  it("reports custom-font capability from resolvers or registered families", () => {
    // fresh isolated registry - the default one is page-global and other
    // tests register custom families into it
    const isolated = new FontRegistry();

    expect(new Fonts(new Scene(), {}, isolated).mayHaveCustomFonts()).toBe(
      false,
    );
    expect(
      new Fonts(
        new Scene(),
        { "test.some": vi.fn() },
        isolated,
      ).mayHaveCustomFonts(),
    ).toBe(true);

    isolated.add("test.direct:Font", "test.direct:Font", METADATA, []);
    expect(new Fonts(new Scene(), {}, isolated).mayHaveCustomFonts()).toBe(
      true,
    );
  });
});

describe("Fonts.runSceneRepair", () => {
  it("defers a repair while a gesture is in flight", () => {
    const element = API.createElement({ type: "text", text: "a" });
    const scene = new Scene();
    scene.replaceAllElements(syncInvalidIndices([element]));

    let gestureInFlight = true;
    const scheduleNonCapturable = vi.fn();
    const fonts = new Fonts(scene, {}, defaultFontRegistry, {
      onBeforeSceneMutation: scheduleNonCapturable,
      shouldDeferSceneMutation: () => gestureInFlight,
    });

    const repaired = 2 as ExcalidrawTextElement["lineHeight"];
    fonts.runSceneRepair(() =>
      scene.mutateElement(
        scene.getElement(element.id) as ExcalidrawTextElement,
        { lineHeight: repaired },
      ),
    );

    // mid-gesture: no mutation and - crucially - no non-capturable
    // scheduling, which would fold the gesture's in-progress movement into
    // the store snapshot and corrupt its undo entry
    expect(scheduleNonCapturable).not.toHaveBeenCalled();
    expect(fonts.hasPendingSceneRepairs()).toBe(true);
    expect(
      (scene.getElement(element.id) as ExcalidrawTextElement).lineHeight,
    ).not.toBe(repaired);

    gestureInFlight = false;
    fonts.flushDeferredSceneRepairs();

    expect(scheduleNonCapturable).toHaveBeenCalledTimes(1);
    expect(
      (scene.getElement(element.id) as ExcalidrawTextElement).lineHeight,
    ).toBe(repaired);
  });
});

describe("custom font CSS family", () => {
  it("registers a custom family under its generated CSS name, never its id", async () => {
    // `toCSS` below can't fetch the face, and falls back to its url
    vi.spyOn(console, "error").mockImplementation(() => {});
    const family = uniqueFamily();
    const fonts = new Fonts(new Scene(), {
      "test.test": async () => ({ fontFaces: FONT_FACES, metadata: METADATA }),
    });

    await fonts.registerCustomFamily(family);

    const [fontFace] = fonts.registered.get(family)!.fontFaces;
    const cssFamily = getCustomFontCSSFamily(family);

    // the id stays our source of truth...
    expect(fontFace.family).toBe(family);
    // ...while the browser only ever sees the generated name - the one font
    // strings (canvas, DOM, `document.fonts.load`) refer to
    expect(fontFace.cssFamily).toBe(cssFamily);
    expect(fontFace.fontFace.family).toBe(cssFamily);
    expect(getFontString({ fontFamily: family, fontSize: 20 })).toContain(
      `20px ${cssFamily},`,
    );

    const css = await fontFace.toCSS("a");
    expect(css).toContain(`font-family: "${cssFamily}"`);
    expect(css).not.toContain(family);
  });

  it("keeps built-in families under their own name", () => {
    const [fontFace] = Fonts.registered.get(FONT_FAMILY.Excalifont)!.fontFaces;

    expect(fontFace.cssFamily).toBe("Excalifont");
    expect(fontFace.fontFace.family).toBe("Excalifont");
  });
});

describe("ExcalidrawFontFace.toCSS", () => {
  it("carries non-default descriptors into the @font-face declaration", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fontFace = new ExcalidrawFontFace(
      "test.test:Descriptors",
      "https://example.com/font.woff2",
      { weight: "700", style: "italic", unicodeRange: "U+0000-00FF" },
    );

    const css = await fontFace.toCSS("a");

    expect(css).toContain('font-family: "test.test:Descriptors"');
    expect(css).toContain("font-weight: 700;");
    expect(css).toContain("font-style: italic;");
    expect(css).toContain("unicode-range: U+0000-00FF;");
  });

  it.each([
    ["a lowercase range", "u+0400-04ff"],
    ["a wildcard range", "U+4??"],
  ])("includes a face whose unicode range is %s", async (_, unicodeRange) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fontFace = new ExcalidrawFontFace(
      "test.test:Ranges",
      "https://example.com/font.woff2",
      { unicodeRange },
    );

    expect(await fontFace.toCSS("Ж")).toContain(
      `unicode-range: ${unicodeRange};`,
    );
    // ...while a face the text doesn't need is still left out
    expect(fontFace.toCSS("1")).toBe(undefined);
  });

  it("emits no descriptors for a default-descriptor face", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fontFace = new ExcalidrawFontFace(
      "test.test:Defaults",
      "https://example.com/font.woff2",
    );

    const css = await fontFace.toCSS("a");

    expect(css).not.toContain("font-weight");
    expect(css).not.toContain("font-style");
    expect(css).not.toContain("unicode-range");
  });
});

describe("Fonts.onLoaded", () => {
  /** text written before its family resolved, as a document may hold it */
  const createSceneWithText = (family: CustomFontFamily) => {
    const element = API.createElement({
      type: "text",
      text: "a",
      fontFamily: family,
    });
    // the fallback's line height, as the family had no metrics yet
    expect(element.lineHeight).not.toBe(METADATA.metrics.lineHeight);

    const scene = new Scene();
    scene.replaceAllElements(syncInvalidIndices([element]));
    return { scene, element };
  };

  const registerFamily = (family: CustomFontFamily) => {
    Fonts.registerCustomFont(family, METADATA, {
      uri: "https://example.com/font.woff2",
    });
    return Fonts.registered.get(family)!.fontFaces[0].fontFace;
  };

  it("never rewrites text which was already in the document", () => {
    const family = uniqueFamily();
    const { scene, element } = createSceneWithText(family);
    const before = { ...scene.getElement(element.id) };
    const triggerUpdate = vi.spyOn(scene, "triggerUpdate");

    new Fonts(scene).onLoaded([registerFamily(family)]);

    // a font arriving isn't an edit: whatever it rewrote would be saved and
    // synced, pinning the document to what the provider returned that day.
    // It only rerenders
    expect(scene.getElement(element.id)).toEqual(before);
    expect(triggerUpdate).toHaveBeenCalledTimes(1);
  });

  it("never rewrites built-in text on a built-in face load", () => {
    const element = API.createElement({ type: "text", text: "builtin" });
    const scene = new Scene();
    scene.replaceAllElements(syncInvalidIndices([element]));
    const versionBefore = (
      scene.getElement(element.id) as ExcalidrawTextElement
    ).version;

    // persisted geometry, incl. legacy `detectLineHeight` documents, must
    // never be re-measured
    const { fontFace } = Fonts.registered.get(FONT_FAMILY.Excalifont)!
      .fontFaces[0];
    new Fonts(scene).onLoaded([fontFace]);

    expect(
      (scene.getElement(element.id) as ExcalidrawTextElement).version,
    ).toBe(versionBefore);
  });

  it("rerenders once per face and instance, even when another editor processed it already", () => {
    const family = uniqueFamily();
    const { scene } = createSceneWithText(family);
    const fontFace = registerFamily(family);

    // another editor on the page handles the `loadingdone` event first - the
    // page-global "loaded" state must not swallow this scene's own pass
    new Fonts(new Scene()).onLoaded([fontFace]);

    const triggerUpdate = vi.spyOn(scene, "triggerUpdate");
    const fonts = new Fonts(scene);

    fonts.onLoaded([fontFace]);
    expect(triggerUpdate).toHaveBeenCalledTimes(1);

    fonts.onLoaded([fontFace]);
    expect(triggerUpdate).toHaveBeenCalledTimes(1);
  });
});

describe("AppFonts lifecycle", () => {
  it("gets its repair hooks back on a remount (i.e. React StrictMode)", () => {
    const scene = new Scene();
    const onBeforeSceneMutation = vi.fn();
    const appFonts = new AppFonts(
      {
        scene,
        props: {},
        state: {},
        ownerDocument: document,
        renderEnvironment: undefined,
      } as unknown as App,
      { onBeforeSceneMutation },
    );

    // unmount leaves a stand-in which must not reach back into the store...
    appFonts.destroy();
    appFonts.instance.runSceneRepair(() => {});
    expect(onBeforeSceneMutation).not.toHaveBeenCalled();

    // ...but the remounted editor needs the real thing
    appFonts.onMount();
    appFonts.instance.runSceneRepair(() => {});
    expect(onBeforeSceneMutation).toHaveBeenCalledTimes(1);
  });
});

describe("AppFonts resolvers", () => {
  it("resolve through the provider callbacks the props hold by then", async () => {
    const provider = (resolve: FontResolver) => ({
      "test.test": { icon: null, availableFonts: [], resolve },
    });
    const staleResolve = vi.fn<FontResolver>(async () => {
      throw new Error("expired");
    });
    const app = {
      scene: new Scene(),
      props: { fontProviders: provider(staleResolve) },
      state: {},
      ownerDocument: document,
      renderEnvironment: undefined,
    };
    const appFonts = new AppFonts(app as unknown as App, {
      onBeforeSceneMutation: () => {},
    });

    // same key, new callbacks (i.e. an inline `fontProviders` object) - the
    // `Fonts` instance stays, see `AppFonts.onPropsUpdated`
    app.props = {
      fontProviders: provider(async () => ({
        fontFaces: FONT_FACES,
        metadata: METADATA,
      })),
    };

    const result = await appFonts.instance.registerCustomFamily(
      uniqueFamily(),
      { recordFailure: false },
    );

    expect(result.status).toBe("success");
    expect(staleResolve).not.toHaveBeenCalled();
  });
});

describe("AppFonts.onSceneUpdated", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("stops loading a family on every update once it has arrived", () => {
    const family = uniqueFamily();
    Fonts.registerCustomFont(family, METADATA, FONT_FACES[0]);

    const scene = new Scene();
    const appFonts = new AppFonts(
      {
        scene,
        props: {},
        state: {},
        ownerDocument: document,
        renderEnvironment: undefined,
      } as unknown as App,
      { onBeforeSceneMutation: () => {} },
    );
    const elements = syncInvalidIndices([
      API.createElement({ type: "text", text: "a", fontFamily: family }),
    ]);
    scene.replaceAllElements(elements);
    const loadSceneFonts = vi.spyOn(appFonts.instance, "loadSceneFonts");

    // i.e. a remote collab update - registered, but nothing of it loaded yet
    appFonts.onSceneUpdated(elements, null);
    expect(loadSceneFonts).toHaveBeenCalledTimes(1);

    appFonts.instance.onLoaded([
      Fonts.registered.get(family)!.fontFaces[0].fontFace,
    ]);

    // past the throttle, so that only the family's state can hold a pass back
    vi.advanceTimersByTime(5000);
    appFonts.onSceneUpdated(elements, null);
    vi.advanceTimersByTime(5000);

    expect(loadSceneFonts).toHaveBeenCalledTimes(1);
    appFonts.destroy();
  });
});

describe("AppFonts.repairTextOnFontLoad", () => {
  const resolver: FontResolver = async () => ({
    fontFaces: FONT_FACES,
    metadata: METADATA,
  });

  /** just the parts of `App` the repair needs */
  const createAppFonts = () => {
    const scene = new Scene();
    const app = {
      scene,
      props: {
        fontProviders: {
          // the provider `uniqueFamily` qualifies its families with
          "test.test": { icon: null, availableFonts: [], resolve: resolver },
        },
      },
      state: {},
      ownerDocument: document,
      renderEnvironment: undefined,
      unmounted: false,
    } as unknown as App;
    return {
      scene,
      appFonts: new AppFonts(app, { onBeforeSceneMutation: () => {} }),
    };
  };

  const createText = (scene: Scene, family: CustomFontFamily) => {
    const element = API.createElement({
      type: "text",
      text: "a",
      fontFamily: family,
    });
    scene.replaceAllElements(syncInvalidIndices([element]));
    return element;
  };

  const getText = (scene: Scene, element: ExcalidrawTextElement) =>
    scene.getElement(element.id) as ExcalidrawTextElement;

  it("converges text measured before its family resolved, once it has", async () => {
    const { scene, appFonts } = createAppFonts();
    // measured in the fallback font, with the fallback's line height
    const element = createText(scene, uniqueFamily());
    expect(element.lineHeight).not.toBe(METADATA.metrics.lineHeight);

    appFonts.repairTextOnFontLoad([element]);

    await vi.waitFor(() =>
      expect(getText(scene, element).lineHeight).toBe(
        METADATA.metrics.lineHeight,
      ),
    );
  });

  it("leaves text alone when its font is in already", async () => {
    const { scene, appFonts } = createAppFonts();
    const family = uniqueFamily();
    Fonts.registerCustomFont(family, METADATA, FONT_FACES[0]);
    appFonts.instance.onLoaded([
      Fonts.registered.get(family)!.fontFaces[0].fontFace,
    ]);

    // i.e. a line height the user (or a host) chose
    const deliberate = 2 as ExcalidrawTextElement["lineHeight"];
    const element = createText(scene, family);
    scene.mutateElement(getText(scene, element), { lineHeight: deliberate });
    const loadElementsFonts = vi.spyOn(Fonts, "loadElementsFonts");

    appFonts.repairTextOnFontLoad([getText(scene, element)]);

    expect(loadElementsFonts).not.toHaveBeenCalled();
    expect(getText(scene, element).lineHeight).toBe(deliberate);
  });

  it("measures again once the glyphs of a loaded family are in, keeping the line height", async () => {
    const { scene, appFonts } = createAppFonts();
    const family = uniqueFamily();
    Fonts.registerCustomFont(family, METADATA, FONT_FACES[0]);
    appFonts.instance.onLoaded([
      Fonts.registered.get(family)!.fontFaces[0].fontFace,
    ]);

    const deliberate = 2 as ExcalidrawTextElement["lineHeight"];
    const element = createText(scene, family);
    // i.e. as measured in the fallback font
    const staleWidth = 999;
    scene.mutateElement(getText(scene, element), {
      lineHeight: deliberate,
      width: staleWidth,
    });

    // the family is in, but not the face (i.e. `unicode-range` subset)
    // holding this text's characters
    vi.mocked(document.fonts.check).mockReturnValueOnce(false);
    appFonts.repairTextOnFontLoad([getText(scene, element)]);

    await vi.waitFor(() =>
      expect(getText(scene, element).width).not.toBe(staleWidth),
    );
    expect(getText(scene, element).lineHeight).toBe(deliberate);
  });

  it("skips text which moved on to another family meanwhile", async () => {
    const { scene, appFonts } = createAppFonts();
    const element = createText(scene, uniqueFamily());
    const loadElementsFonts = vi.spyOn(Fonts, "loadElementsFonts");

    appFonts.repairTextOnFontLoad([element]);
    scene.mutateElement(getText(scene, element), {
      fontFamily: FONT_FAMILY.Nunito,
    });
    const before = { ...getText(scene, element) };

    await loadElementsFonts.mock.results[0].value;
    await Promise.resolve();

    expect(getText(scene, element)).toEqual(before);
  });
});

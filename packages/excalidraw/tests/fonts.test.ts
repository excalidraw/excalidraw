import { Scene, syncInvalidIndices } from "@excalidraw/element";

import {
  createProviderFontFamily,
  FONT_FAMILY,
  isFontMetadataAvailable,
  parseProviderFontFamily,
} from "@excalidraw/common";

import type { CustomFontFamily, FontMetadata } from "@excalidraw/common";

import type { ExcalidrawTextElement } from "@excalidraw/element/types";

import { defaultFontRegistry, FontRegistry, Fonts } from "../fonts";
import { ExcalidrawFontFace } from "../fonts/ExcalidrawFontFace";

import { API } from "./helpers/api";
import { muteExpectedFontErrors } from "./helpers/mocks";

import type { FontResolver } from "../fonts";

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
const uniqueFamily = (): CustomFontFamily => `test:Roboto-${counter++}`;

describe("provider-qualified font families", () => {
  it("creates and parses provider-qualified family ids", () => {
    const family = createProviderFontFamily("provider", "Font:Variant");

    expect(family).toBe("provider:Font:Variant");
    expect(parseProviderFontFamily(family)).toEqual({
      providerId: "provider",
      familyName: "Font:Variant",
    });
    expect(parseProviderFontFamily("Font")).toBeNull();
    expect(parseProviderFontFamily(":Font")).toBeNull();
  });

  it("rejects invalid provider keys", () => {
    expect(() => new Fonts(new Scene(), { "": vi.fn() })).toThrow(
      "Font provider key must be non-empty",
    );
    expect(() => new Fonts(new Scene(), { "bad:key": vi.fn() })).toThrow(
      "must not contain",
    );
    // CSS font-family matching is case-insensitive - "Google" and "google"
    // would land in the same browser family bucket under different keys
    expect(() => new Fonts(new Scene(), { Google: vi.fn() })).toThrow(
      "lowercase",
    );
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
      fonts.registerCustomFamilies(["missing:Font"]),
    ).resolves.toEqual([
      {
        family: "missing:Font",
        status: "unsupported",
      },
    ]);
    expect(fonts.failedResolutions.has("missing:Font")).toBe(false);
  });

  it("tracks resolver failures and clears them after a successful retry", async () => {
    const failure = new Error("temporary failure");
    const resolve = vi
      .fn()
      .mockRejectedValueOnce(failure)
      .mockResolvedValueOnce({ fontFaces: FONT_FACES, metadata: METADATA });
    const fonts = new Fonts(new Scene(), { retry: resolve });
    const initialRegisteredFonts = fonts.registered;
    const onRegisteredFontsChange = vi.fn();
    const unsubscribe = fonts.onRegisteredFontsChangeEmitter.on(
      onRegisteredFontsChange,
    );

    await expect(fonts.registerCustomFamilies(["retry:Font"])).resolves.toEqual(
      [
        {
          family: "retry:Font",
          status: "failed",
        },
      ],
    );
    expect(fonts.failedResolutions.has("retry:Font")).toBe(true);
    // the rejection is retained, i.e. for debugging
    expect(fonts.failedResolutions.get("retry:Font")).toBe(failure);
    expect(fonts.registered).toBe(initialRegisteredFonts);
    expect(onRegisteredFontsChange).not.toHaveBeenCalled();

    await expect(fonts.registerCustomFamilies(["retry:Font"])).resolves.toEqual(
      [
        {
          family: "retry:Font",
          status: "success",
        },
      ],
    );
    expect(fonts.failedResolutions.has("retry:Font")).toBe(false);
    expect(fonts.registered.has("retry:Font")).toBe(true);
    expect(fonts.registered).not.toBe(initialRegisteredFonts);
    expect(onRegisteredFontsChange).toHaveBeenCalledWith(fonts.registered);
    unsubscribe();
  });

  it("emits one registry update after bulk registration settles", async () => {
    const fonts = new Fonts(new Scene(), {
      bulk: vi.fn().mockResolvedValue({
        fontFaces: FONT_FACES,
        metadata: METADATA,
      }),
    });
    const onRegisteredFontsChange = vi.fn();
    const unsubscribe = fonts.onRegisteredFontsChangeEmitter.on(
      onRegisteredFontsChange,
    );

    await expect(
      fonts.registerCustomFamilies(["bulk:First", "bulk:Second"]),
    ).resolves.toEqual([
      { family: "bulk:First", status: "success" },
      { family: "bulk:Second", status: "success" },
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
    const fonts = new Fonts(new Scene(), { mixed: resolve });
    const onRegisteredFontsChange = vi.fn();
    const unsubscribe = fonts.onRegisteredFontsChangeEmitter.on(
      onRegisteredFontsChange,
    );

    const batch = fonts.registerCustomFamilies(["mixed:Fast", "mixed:Slow"]);

    // a slow (or hanging) batch-mate must not mute Fast's announcement -
    // pickers and other editors key their state off this emit
    await vi.waitFor(() => {
      expect(fonts.registered.has("mixed:Fast")).toBe(true);
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
    const firstFonts = new Fonts(new Scene(), { inflight: resolve });
    const secondFonts = new Fonts(new Scene(), { inflight: resolve });

    const firstRegistration = firstFonts.registerCustomFamily("inflight:Font");
    const secondRegistration =
      secondFonts.registerCustomFamily("inflight:Font");

    // the resolver runs once its concurrency slot is granted (a microtask)
    await vi.waitFor(() => expect(resolve).toHaveBeenCalledTimes(1));
    expect(firstFonts.registered).toBe(secondFonts.registered);
    resolveFont({ fontFaces: FONT_FACES, metadata: METADATA });

    await expect(
      Promise.all([firstRegistration, secondRegistration]),
    ).resolves.toEqual([
      { family: "inflight:Font", status: "success" },
      { family: "inflight:Font", status: "success" },
    ]);
    expect(resolve).toHaveBeenCalledTimes(1);
  });

  it("registers additional families while loading scene fonts", async () => {
    const resolve = vi
      .fn()
      .mockResolvedValue({ fontFaces: FONT_FACES, metadata: METADATA });
    const fonts = new Fonts(new Scene(), { scene: resolve });

    await fonts.loadSceneFonts(["scene:Current"]);

    expect(resolve).toHaveBeenCalledWith("Current");
    expect(fonts.registered.has("scene:Current")).toBe(true);
  });

  it("loads already-resolved families without waiting on pending resolvers", async () => {
    const check = vi.spyOn(document.fonts, "check").mockReturnValue(false);
    const load = vi.spyOn(document.fonts, "load").mockResolvedValue([]);
    let resolveFont!: (font: Awaited<ReturnType<FontResolver>>) => void;
    const fonts = new Fonts(new Scene(), {
      pending: vi.fn(
        () =>
          new Promise<Awaited<ReturnType<FontResolver>>>((resolve) => {
            resolveFont = resolve;
          }),
      ),
    });

    try {
      const loading = fonts.loadSceneFonts([
        FONT_FAMILY.Excalifont,
        "pending:Font",
      ]);

      // a resolver that never settles must not hold back the built-in font
      await vi.waitFor(() =>
        expect(load).toHaveBeenCalledWith(
          expect.stringContaining("Excalifont"),
          expect.anything(),
        ),
      );
      expect(fonts.registered.has("pending:Font")).toBe(false);

      await vi.waitFor(() => expect(resolveFont).toBeDefined());
      resolveFont({ fontFaces: FONT_FACES, metadata: METADATA });
      await loading;

      expect(fonts.registered.has("pending:Font")).toBe(true);
    } finally {
      check.mockRestore();
      load.mockRestore();
    }
  });

  it("keeps registered custom families loadable", async () => {
    const fonts = new Fonts(new Scene(), {
      loadable: vi
        .fn()
        .mockResolvedValue({ fontFaces: FONT_FACES, metadata: METADATA }),
    });

    expect(fonts.shouldLoadCustomFamily("loadable:Font")).toBe(true);

    await fonts.registerCustomFamily("loadable:Font");

    // registering only installs the font faces - they still need loading
    expect(fonts.registered.has("loadable:Font")).toBe(true);
    expect(fonts.shouldLoadCustomFamily("loadable:Font")).toBe(true);
    expect(fonts.shouldLoadCustomFamily(FONT_FAMILY.Excalifont)).toBe(false);
  });

  it("treats a malformed resolver definition as a failure", async () => {
    const resolve = vi.fn().mockResolvedValue({
      fontFaces: [],
      metadata: METADATA,
    });
    const fonts = new Fonts(new Scene(), { malformed: resolve });

    // garbage reported as success would crash metric consumers much later
    await expect(fonts.registerCustomFamily("malformed:Font")).resolves.toEqual(
      { family: "malformed:Font", status: "failed" },
    );
    expect(fonts.failedResolutions.has("malformed:Font")).toBe(true);
    expect(fonts.registered.has("malformed:Font")).toBe(false);
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
    const fonts = new Fonts(new Scene(), { capped: resolve });

    const families = Array.from(
      { length: 12 },
      (_, index): CustomFontFamily => `capped:Font-${index}`,
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
      real: vi
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
    const first = new Fonts(new Scene(), { sharedfailure: resolve });
    const second = new Fonts(new Scene(), { sharedfailure: resolve });
    const onFailedResolutionsChange = vi.fn();
    const unsubscribe = second.onFailedResolutionsChangeEmitter.on(
      onFailedResolutionsChange,
    );

    await first.registerCustomFamily("sharedfailure:Font");

    // page-scoped, like the registry it guards
    expect(second.failedResolutions.has("sharedfailure:Font")).toBe(true);
    expect(second.shouldLoadCustomFamily("sharedfailure:Font")).toBe(false);
    expect(onFailedResolutionsChange).toHaveBeenCalledWith(
      second.failedResolutions,
    );
    unsubscribe();
  });

  it("does not record failures for headless element registration", async () => {
    const resolve = vi.fn().mockRejectedValue(new Error("offline"));
    const fonts = new Fonts(new Scene(), { headless: resolve });

    await fonts.registerCustomFamilies(["headless:Font"], {
      recordFailure: false,
    });

    expect(resolve).toHaveBeenCalledTimes(1);
    expect(fonts.failedResolutions.has("headless:Font")).toBe(false);
  });

  it("does not let a speculative attempt clear a recorded failure", async () => {
    const resolve = vi.fn().mockRejectedValue(new Error("down"));
    const fonts = new Fonts(new Scene(), { probe: resolve });

    await fonts.registerCustomFamily("probe:Font");
    expect(fonts.failedResolutions.has("probe:Font")).toBe(true);

    // i.e. a search probing this provider, or a headless export - failing
    // without recording must leave the recorded verdict untouched, or the
    // family would silently re-enter automatic loading
    await fonts.registerCustomFamily("probe:Font", { recordFailure: false });
    expect(fonts.failedResolutions.has("probe:Font")).toBe(true);
    expect(fonts.shouldLoadCustomFamily("probe:Font")).toBe(false);
  });

  it("clears a recorded failure when the family resolves, even speculatively", async () => {
    const resolve = vi
      .fn()
      .mockRejectedValueOnce(new Error("down"))
      .mockResolvedValue({ fontFaces: FONT_FACES, metadata: METADATA });
    const fonts = new Fonts(new Scene(), { probeclear: resolve });

    await fonts.registerCustomFamily("probeclear:Font");
    expect(fonts.failedResolutions.has("probeclear:Font")).toBe(true);

    // the definition is registered page-wide at that point, so there is
    // nothing left to be failed about
    await fonts.registerCustomFamily("probeclear:Font", {
      recordFailure: false,
    });
    expect(fonts.failedResolutions.has("probeclear:Font")).toBe(false);
    expect(fonts.registered.has("probeclear:Font")).toBe(true);
  });

  it("does not track speculative resolution failures", async () => {
    const resolve = vi.fn().mockRejectedValue(new Error("not carried"));
    const fonts = new Fonts(new Scene(), { speculative: resolve });

    await expect(
      fonts.registerCustomFamily("speculative:Font", { recordFailure: false }),
    ).resolves.toEqual({ family: "speculative:Font", status: "failed" });
    expect(fonts.failedResolutions.has("speculative:Font")).toBe(false);

    await expect(
      fonts.registerCustomFamily("speculative:Font"),
    ).resolves.toEqual({ family: "speculative:Font", status: "failed" });
    expect(fonts.failedResolutions.has("speculative:Font")).toBe(true);
  });

  it("only retries failed automatic loads when explicitly requested", async () => {
    const resolve = vi.fn().mockRejectedValue(new Error("unavailable"));
    const fonts = new Fonts(new Scene(), { automatic: resolve });

    await fonts.loadSceneFonts(["automatic:Font"]);
    await fonts.loadSceneFonts(["automatic:Font"]);
    expect(resolve).toHaveBeenCalledTimes(1);

    await fonts.registerCustomFamily("automatic:Font");
    expect(resolve).toHaveBeenCalledTimes(2);
  });

  it("only marks resolvable missing definitions as loadable", async () => {
    const resolve = vi.fn().mockRejectedValue(new Error("unavailable"));
    const fonts = new Fonts(new Scene(), { actionable: resolve });

    expect(fonts.shouldLoadCustomFamily("actionable:Font")).toBe(true);
    expect(fonts.shouldLoadCustomFamily("missing:Font")).toBe(false);
    expect(fonts.shouldLoadCustomFamily(FONT_FAMILY.Assistant)).toBe(false);

    await fonts.registerCustomFamily("actionable:Font");
    expect(fonts.shouldLoadCustomFamily("actionable:Font")).toBe(false);
  });

  it("reuses a resolved definition without a resolver", async () => {
    const resolve = vi
      .fn()
      .mockResolvedValue({ fontFaces: FONT_FACES, metadata: METADATA });
    const resolvingFonts = new Fonts(new Scene(), { shared: resolve });
    const resolverlessFonts = new Fonts(new Scene());

    await expect(
      resolvingFonts.registerCustomFamily("shared:Font"),
    ).resolves.toEqual({ family: "shared:Font", status: "success" });
    await expect(
      resolverlessFonts.registerCustomFamily("shared:Font"),
    ).resolves.toEqual({ family: "shared:Font", status: "success" });

    expect(resolve).toHaveBeenCalledTimes(1);
    expect(resolverlessFonts.registered.has("shared:Font")).toBe(true);
  });

  it("logs resource-load failures for custom families", async () => {
    const loadError = new Error("network failure");
    const check = vi.spyOn(document.fonts, "check").mockReturnValue(false);
    const load = vi.spyOn(document.fonts, "load").mockRejectedValue(loadError);
    const fonts = new Fonts(new Scene(), {
      resource: vi.fn().mockResolvedValue({
        fontFaces: [{ uri: "https://example.com/font.woff2" }],
        metadata: METADATA,
      }),
    });

    try {
      await fonts.loadSceneFonts(["resource:Font"]);

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
      { test: resolve },
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
      pendingelements: vi.fn(
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
        fontFamily: "pendingelements:Font",
      });
      const loading = Fonts.loadElementsFonts([builtin, custom], fonts);

      // pasted built-in text must not wait for a resolver to settle
      await vi.waitFor(() =>
        expect(load).toHaveBeenCalledWith(
          expect.stringContaining("Excalifont"),
          expect.anything(),
        ),
      );
      expect(fonts.registered.has("pendingelements:Font")).toBe(false);

      await vi.waitFor(() => expect(resolveFont).toBeDefined());
      resolveFont({ fontFaces: FONT_FACES, metadata: METADATA });
      await loading;

      expect(fonts.registered.has("pendingelements:Font")).toBe(true);
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
    const fonts = new Fonts(new Scene(), { exportretry: resolve });

    // an accountable attempt records the failure
    await fonts.registerCustomFamily("exportretry:Font");
    expect(fonts.failedResolutions.has("exportretry:Font")).toBe(true);

    const text = API.createElement({
      type: "text",
      text: "a",
      fontFamily: "exportretry:Font",
    });

    // a failure-recording load keeps respecting the verdict
    await Fonts.loadElementsFonts([text], fonts);
    expect(resolve).toHaveBeenCalledTimes(1);

    // the export path (recordFailure: false) retries and recovers
    await Fonts.loadElementsFonts([text], fonts, { recordFailure: false });
    expect(resolve).toHaveBeenCalledTimes(2);
    expect(fonts.registered.has("exportretry:Font")).toBe(true);
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

describe("Fonts.mayHaveCustomFonts", () => {
  it("reports custom-font capability from resolvers or registered families", () => {
    // fresh isolated registry - the default one is page-global and other
    // tests register custom families into it
    const isolated = new FontRegistry();

    expect(new Fonts(new Scene(), {}, isolated).mayHaveCustomFonts()).toBe(
      false,
    );
    expect(
      new Fonts(new Scene(), { some: vi.fn() }, isolated).mayHaveCustomFonts(),
    ).toBe(true);

    isolated.add("direct:Font", "direct:Font", METADATA, []);
    expect(new Fonts(new Scene(), {}, isolated).mayHaveCustomFonts()).toBe(
      true,
    );
  });
});

describe("Fonts.runSceneRepair", () => {
  it("defers the reflow while a gesture is in flight", () => {
    const family = uniqueFamily();

    // created before resolution - bakes in the fallback's line height
    const element = API.createElement({
      type: "text",
      text: "a",
      fontFamily: family,
    });
    expect(element.lineHeight).not.toBe(METADATA.metrics.lineHeight);

    Fonts.registerCustomFont(family, METADATA, {
      uri: "https://example.com/font.woff2",
    });

    const scene = new Scene();
    scene.replaceAllElements(syncInvalidIndices([element]));

    let gestureInFlight = true;
    const scheduleNonCapturable = vi.fn();
    const fonts = new Fonts(scene, {}, defaultFontRegistry, {
      onBeforeSceneMutation: scheduleNonCapturable,
      shouldDeferSceneMutation: () => gestureInFlight,
    });

    const { fontFace } = Fonts.registered.get(family)!.fontFaces[0];
    fonts.onLoaded([fontFace]);

    // mid-gesture: no mutation and - crucially - no non-capturable
    // scheduling, which would fold the gesture's in-progress movement into
    // the store snapshot and corrupt its undo entry
    expect(scheduleNonCapturable).not.toHaveBeenCalled();
    expect(
      (scene.getElement(element.id) as ExcalidrawTextElement).lineHeight,
    ).not.toBe(METADATA.metrics.lineHeight);

    gestureInFlight = false;
    fonts.flushDeferredSceneRepairs();

    expect(scheduleNonCapturable).toHaveBeenCalledTimes(1);
    expect(
      (scene.getElement(element.id) as ExcalidrawTextElement).lineHeight,
    ).toBe(METADATA.metrics.lineHeight);
  });
});

describe("ExcalidrawFontFace", () => {
  it("passes the raw, unquoted family to the FontFace constructor", () => {
    const fontFace = new ExcalidrawFontFace(
      "test:Unquoted",
      "https://example.com/font.woff2",
    );

    // unlike the emitted declaration below, which must be quoted
    expect(fontFace.fontFace.family).toBe("test:Unquoted");
  });
});

describe("ExcalidrawFontFace.toCSS", () => {
  it("carries non-default descriptors into the @font-face declaration", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fontFace = new ExcalidrawFontFace(
      "test:Descriptors",
      "https://example.com/font.woff2",
      { weight: "700", style: "italic", unicodeRange: "U+0000-00FF" },
    );

    const css = await fontFace.toCSS("a");

    expect(css).toContain('font-family: "test:Descriptors"');
    expect(css).toContain("font-weight: 700;");
    expect(css).toContain("font-style: italic;");
    expect(css).toContain("unicode-range: U+0000-00FF;");
  });

  it("emits no descriptors for a default-descriptor face", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fontFace = new ExcalidrawFontFace(
      "test:Defaults",
      "https://example.com/font.woff2",
    );

    const css = await fontFace.toCSS("a");

    expect(css).not.toContain("font-weight");
    expect(css).not.toContain("font-style");
    expect(css).not.toContain("unicode-range");
  });
});

describe("Fonts.onLoaded", () => {
  it("converges the line height of elements written before their family resolved", () => {
    const family = uniqueFamily();

    // created before resolution - bakes in the fallback's line height
    const element = API.createElement({
      type: "text",
      text: "a",
      fontFamily: family,
    });
    expect(element.lineHeight).not.toBe(METADATA.metrics.lineHeight);

    Fonts.registerCustomFont(family, METADATA, {
      uri: "https://example.com/font.woff2",
    });

    const scene = new Scene();
    scene.replaceAllElements(syncInvalidIndices([element]));

    const { fontFace } = Fonts.registered.get(family)!.fontFaces[0];
    new Fonts(scene).onLoaded([fontFace]);

    expect(
      (scene.getElement(element.id) as ExcalidrawTextElement).lineHeight,
    ).toBe(METADATA.metrics.lineHeight);
  });

  it("reflows a loaded family's elements even when the line height already matches", () => {
    const family = uniqueFamily();

    Fonts.registerCustomFont(family, METADATA, {
      uri: "https://example.com/font.woff2",
    });

    // created after registration - the line height is already the family's
    // own, but the glyph measurements happened with the fallback font
    const element = API.createElement({
      type: "text",
      text: "a",
      fontFamily: family,
    });
    expect(element.lineHeight).toBe(METADATA.metrics.lineHeight);

    const scene = new Scene();
    scene.replaceAllElements(syncInvalidIndices([element]));
    const versionBefore = (
      scene.getElement(element.id) as ExcalidrawTextElement
    ).version;

    const { fontFace } = Fonts.registered.get(family)!.fontFaces[0];
    new Fonts(scene).onLoaded([fontFace]);

    // the reflow must not hinge on a line-height change - a family can share
    // the fallback's ratio while having different glyph widths
    expect(
      (scene.getElement(element.id) as ExcalidrawTextElement).version,
    ).toBeGreaterThan(versionBefore);
  });

  it("reports already-loaded faces so a later-mounted editor can reflow", async () => {
    const family = uniqueFamily();

    // created before resolution - bakes in the fallback's line height
    const element = API.createElement({
      type: "text",
      text: "a",
      fontFamily: family,
    });
    expect(element.lineHeight).not.toBe(METADATA.metrics.lineHeight);

    Fonts.registerCustomFont(family, METADATA, {
      uri: "https://example.com/font.woff2",
    });

    // the face loaded page-wide before this editor mounted, so this editor
    // missed the `loadingdone` event and `document.fonts.check` passes
    const { fontFace } = Fonts.registered.get(family)!.fontFaces[0];
    (fontFace as { status: string }).status = "loaded";
    const check = vi.spyOn(document.fonts, "check").mockReturnValue(true);

    try {
      const scene = new Scene();
      scene.replaceAllElements(syncInvalidIndices([element]));
      const fonts = new Fonts(scene);

      // mimics the App: scene loads report faces, `onLoaded` processes them
      fonts.onLoaded(await fonts.loadSceneFonts());

      expect(
        (scene.getElement(element.id) as ExcalidrawTextElement).lineHeight,
      ).toBe(METADATA.metrics.lineHeight);
    } finally {
      check.mockRestore();
    }
  });

  it("never reflows built-in text on a built-in face load", () => {
    const element = API.createElement({ type: "text", text: "builtin" });
    const scene = new Scene();
    scene.replaceAllElements(syncInvalidIndices([element]));
    const versionBefore = (
      scene.getElement(element.id) as ExcalidrawTextElement
    ).version;

    // a built-in face loading invalidates caches only (master behavior) -
    // persisted geometry, incl. legacy `detectLineHeight` documents, must
    // never be re-measured
    const { fontFace } = Fonts.registered.get(FONT_FAMILY.Excalifont)!
      .fontFaces[0];
    new Fonts(scene).onLoaded([fontFace]);

    expect(
      (scene.getElement(element.id) as ExcalidrawTextElement).version,
    ).toBe(versionBefore);
  });

  it("processes a face for each instance, even when another editor already did", () => {
    const family = uniqueFamily();

    // created before resolution - bakes in the fallback's line height
    const element = API.createElement({
      type: "text",
      text: "a",
      fontFamily: family,
    });
    expect(element.lineHeight).not.toBe(METADATA.metrics.lineHeight);

    Fonts.registerCustomFont(family, METADATA, {
      uri: "https://example.com/font.woff2",
    });

    const { fontFace } = Fonts.registered.get(family)!.fontFaces[0];

    // another editor on the page handles the `loadingdone` event first - the
    // page-global "loaded" state must not swallow this scene's own pass
    new Fonts(new Scene()).onLoaded([fontFace]);

    const scene = new Scene();
    scene.replaceAllElements(syncInvalidIndices([element]));
    new Fonts(scene).onLoaded([fontFace]);

    expect(
      (scene.getElement(element.id) as ExcalidrawTextElement).lineHeight,
    ).toBe(METADATA.metrics.lineHeight);
  });

  it("leaves the line height of other families' elements alone", () => {
    const family = uniqueFamily();
    const otherFamily = uniqueFamily();

    // baked-in fallback line height, diverging from the family metric
    const element = API.createElement({
      type: "text",
      text: "a",
      fontFamily: family,
    });
    const baked = element.lineHeight;
    expect(baked).not.toBe(METADATA.metrics.lineHeight);

    Fonts.registerCustomFont(family, METADATA, {
      uri: "https://example.com/font.woff2",
    });
    Fonts.registerCustomFont(otherFamily, METADATA, {
      uri: "https://example.com/other.woff2",
    });

    const scene = new Scene();
    scene.replaceAllElements(syncInvalidIndices([element]));

    // an unrelated family's load must not converge this element
    const { fontFace } = Fonts.registered.get(otherFamily)!.fontFaces[0];
    new Fonts(scene).onLoaded([fontFace]);

    expect(
      (scene.getElement(element.id) as ExcalidrawTextElement).lineHeight,
    ).toBe(baked);
  });

  it("never converges a line height set after the family's faces loaded", () => {
    const family = uniqueFamily();

    Fonts.registerCustomFont(family, METADATA, {
      uri: "https://example.com/font.woff2",
    });

    const element = API.createElement({
      type: "text",
      text: "a",
      fontFamily: family,
    });
    const scene = new Scene();
    scene.replaceAllElements(syncInvalidIndices([element]));
    const fonts = new Fonts(scene);

    const { fontFace } = Fonts.registered.get(family)!.fontFaces[0];
    fonts.onLoaded([fontFace]);

    // a deliberately divergent (i.e. host-set) value must survive
    // further load events
    const deliberate = 2 as ExcalidrawTextElement["lineHeight"];
    scene.mutateElement(scene.getElement(element.id) as ExcalidrawTextElement, {
      lineHeight: deliberate,
    });
    fonts.onLoaded([fontFace]);

    expect(
      (scene.getElement(element.id) as ExcalidrawTextElement).lineHeight,
    ).toBe(deliberate);
  });
});

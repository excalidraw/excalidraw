import {
  configureObsidianCommonHost,
  getObsidianCommonHost,
  hasObsidianCommonHost,
  OBSIDIAN_COMMON_HOST_PROTOCOL_VERSION,
  type ObsidianCommonHostAdapter,
  type ObsidianCommonHostDisposer,
} from "./commonObsidianHost";
import {
  getAreaLimit,
  getDesktopUIMode,
  getHighlightColor,
  getObsidianDeviceInfo,
  getPreferredUIMode,
  getWidthHeightLimit,
} from "./commonObsidianUtils";

const preferredModes = {
  phone: "mobile",
  tablet: "compact",
  desktop: "full",
} as const;

const createFakeHost = (
  areaLimit: number,
  widthHeightLimit = 32_767,
): ObsidianCommonHostAdapter => ({
  protocolVersion: OBSIDIAN_COMMON_HOST_PROTOCOL_VERSION,
  getDeviceInfo: () => ({
    isDesktop: true,
    isPhone: false,
    isTablet: false,
    isMobile: false,
    isLinux: false,
    isMacOS: true,
    isWindows: false,
    isIOS: false,
    isAndroid: false,
  }),
  getDesktopUIMode: () => "tray",
  getPreferredUIMode: (formFactor) =>
    formFactor === "phone" ? "mobile" : "tray",
  getCanvasLimits: () => ({ areaLimit, widthHeightLimit }),
  getHighlightColor: (_sceneBackgroundColor, opacity) =>
    `rgba(0,118,255,${opacity})`,
});

describe("Obsidian common host registry", () => {
  const disposers: ObsidianCommonHostDisposer[] = [];

  afterEach(() => {
    while (disposers.length > 0) {
      disposers.pop()?.();
    }
  });

  const configure = (adapter: ObsidianCommonHostAdapter) => {
    const dispose = configureObsidianCommonHost(adapter);
    disposers.push(dispose);
    return dispose;
  };

  it("starts without requiring an Obsidian plugin or global app", () => {
    expect(getObsidianCommonHost()).toBeNull();
    expect(hasObsidianCommonHost()).toBe(false);
  });

  it("exposes capabilities from a configured structural fake", () => {
    configure(createFakeHost(123));

    const host = getObsidianCommonHost();
    expect(host?.getCanvasLimits()).toEqual({
      areaLimit: 123,
      widthHeightLimit: 32_767,
    });
    expect(host?.getPreferredUIMode("phone")).toBe("mobile");
    expect(host?.getHighlightColor("#ffffff", 0.5)).toBe("rgba(0,118,255,0.5)");
    expect(hasObsidianCommonHost()).toBe(true);
  });

  it("supplies both render-canvas limits without loading the plugin", () => {
    configure(createFakeHost(12_345, 6_789));

    expect(getAreaLimit()).toBe(12_345);
    expect(getWidthHeightLimit()).toBe(6_789);
  });

  it("supplies device capabilities without loading the plugin", () => {
    configure(createFakeHost(123));

    expect(getObsidianDeviceInfo()).toEqual({
      isDesktop: true,
      isPhone: false,
      isTablet: false,
      isMobile: false,
      isLinux: false,
      isMacOS: true,
      isWindows: false,
      isIOS: false,
      isAndroid: false,
    });
  });

  it("supplies and normalizes the desktop UI mode without loading the plugin", () => {
    configure({
      ...createFakeHost(123),
      getDesktopUIMode: () => "compact",
    });
    expect(getDesktopUIMode()).toBe("compact");

    configure({
      ...createFakeHost(123),
      getDesktopUIMode: () => "unsupported",
    } as unknown as ObsidianCommonHostAdapter);
    expect(getDesktopUIMode()).toBe("tray");
  });

  it("supplies preferred UI modes for every form factor without loading the plugin", () => {
    configure({
      ...createFakeHost(123),
      getPreferredUIMode: (formFactor) => preferredModes[formFactor],
    });

    expect(getPreferredUIMode("phone")).toBe("mobile");
    expect(getPreferredUIMode("tablet")).toBe("compact");
    expect(getPreferredUIMode("desktop")).toBe("full");
  });

  it("forwards highlight inputs and default opacity without loading the plugin", () => {
    const highlight = vi.fn(
      (sceneBackgroundColor: string, opacity: number) =>
        `${sceneBackgroundColor}:${opacity}`,
    );
    configure({
      ...createFakeHost(123),
      getHighlightColor: highlight,
    });

    expect(getHighlightColor("#ffffff", 0.4)).toBe("#ffffff:0.4");
    expect(getHighlightColor("#000000")).toBe("#000000:1");
    expect(highlight).toHaveBeenNthCalledWith(1, "#ffffff", 0.4);
    expect(highlight).toHaveBeenNthCalledWith(2, "#000000", 1);
  });

  it("disposes the active registration idempotently", () => {
    const dispose = configure(createFakeHost(123));

    dispose();
    dispose();

    expect(getObsidianCommonHost()).toBeNull();
    expect(hasObsidianCommonHost()).toBe(false);
  });

  it("does not let a stale disposer clear a newer registration", () => {
    const disposeFirst = configure(createFakeHost(123));
    configure(createFakeHost(456));

    disposeFirst();

    expect(getObsidianCommonHost()?.getCanvasLimits().areaLimit).toBe(456);
  });

  it("rejects an unsupported runtime protocol", () => {
    const incompatibleHost = {
      ...createFakeHost(123),
      protocolVersion: 2,
    } as unknown as ObsidianCommonHostAdapter;

    expect(() => configureObsidianCommonHost(incompatibleHost)).toThrow(
      "Unsupported Obsidian common host protocol: 2",
    );
    expect(getObsidianCommonHost()).toBeNull();
  });
});

import {
  configureObsidianCommonHost,
  getObsidianCommonHost,
  hasObsidianCommonHost,
  OBSIDIAN_COMMON_HOST_PROTOCOL_VERSION,
  type ObsidianCommonHostAdapter,
  type ObsidianCommonHostDisposer,
} from "./commonObsidianHost";
import { getAreaLimit, getWidthHeightLimit } from "./commonObsidianUtils";

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

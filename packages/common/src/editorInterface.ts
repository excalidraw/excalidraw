export type StylesPanelMode = "compact" | "full" | "mobile";

export type EditorInterface = Readonly<{
  formFactor: "phone" | "tablet" | "desktop";
  desktopUIMode: "compact" | "full";
  userAgent: Readonly<{
    raw: string;
    isMobileDevice: boolean;
    platform: "ios" | "android" | "other" | "unknown";
  }>;
  isTouchScreen: boolean;
  canFitSidebar: boolean;
  isLandscape: boolean;
}>;

export const DESKTOP_UI_MODE_STORAGE_KEY = "excalidraw.desktopUIMode";

export const isDarwin = /Mac|iPod|iPhone|iPad/.test(navigator.platform);
export const isWindows = /^Win/.test(navigator.platform);
export const isAndroid = /\b(android)\b/i.test(navigator.userAgent);
export const isFirefox =
  typeof window !== "undefined" &&
  "netscape" in window &&
  navigator.userAgent.indexOf("rv:") > 1 &&
  navigator.userAgent.indexOf("Gecko") > 1;
export const isChrome = navigator.userAgent.indexOf("Chrome") !== -1;
export const isSafari =
  !isChrome && navigator.userAgent.indexOf("Safari") !== -1;
export const isIOS =
  /iPad|iPhone/i.test(navigator.platform) ||
  // iPadOS 13+
  (navigator.userAgent.includes("Mac") && "ontouchend" in document);
// keeping function so it can be mocked in test
export const isBrave = () =>
  (navigator as any).brave?.isBrave?.name === "isBrave";

export const isMobile =
  isIOS ||
  /android|webos|ipod|blackberry|iemobile|opera mini/i.test(
    navigator.userAgent,
  ) ||
  /android|ios|ipod|blackberry|windows phone/i.test(navigator.platform);

export const isMobileOrTablet = (): boolean => {
  const ua = navigator.userAgent || "";
  const platform = navigator.platform || "";
  const uaData = (navigator as any).userAgentData as
    | { mobile?: boolean; platform?: string }
    | undefined;

  // --- 1) chromium: prefer ua client hints -------------------------------
  if (uaData) {
    const plat = (uaData.platform || "").toLowerCase();
    const isDesktopOS =
      plat === "windows" ||
      plat === "macos" ||
      plat === "linux" ||
      plat === "chrome os";
    if (uaData.mobile === true) {
      return true;
    }
    if (uaData.mobile === false && plat === "android") {
      const looksTouchTablet =
        matchMedia?.("(hover: none)").matches &&
        matchMedia?.("(pointer: coarse)").matches;
      return looksTouchTablet;
    }
    if (isDesktopOS) {
      return false;
    }
  }

  // --- 2) ios (includes ipad) --------------------------------------------
  if (isIOS) {
    return true;
  }

  // --- 3) android legacy ua fallback -------------------------------------
  if (isAndroid) {
    const isAndroidPhone = /Mobile/i.test(ua);
    const isAndroidTablet = !isAndroidPhone;
    if (isAndroidPhone || isAndroidTablet) {
      const looksTouchTablet =
        matchMedia?.("(hover: none)").matches &&
        matchMedia?.("(pointer: coarse)").matches;
      return looksTouchTablet;
    }
  }

  // --- 4) last resort desktop exclusion ----------------------------------
  const looksDesktopPlatform =
    /Win|Linux|CrOS|Mac/.test(platform) ||
    /Windows NT|X11|CrOS|Macintosh/.test(ua);
  if (looksDesktopPlatform) {
    return false;
  }
  return false;
};

export const deriveFormFactor = (
  editorWidth: number,
  editorHeight: number,
  breakpoints: {
    isMobile: (width: number, height: number) => boolean;
    isTablet: (width: number, height: number) => boolean;
  },
): EditorInterface["formFactor"] => {
  if (breakpoints.isMobile(editorWidth, editorHeight)) {
    return "phone";
  }

  if (breakpoints.isTablet(editorWidth, editorHeight)) {
    return "tablet";
  }

  return "desktop";
};

export const deriveStylesPanelMode = (
  editorInterface: EditorInterface,
): StylesPanelMode => {
  if (editorInterface.formFactor === "phone") {
    return "mobile";
  }

  if (editorInterface.formFactor === "tablet") {
    return "compact";
  }

  return editorInterface.desktopUIMode;
};

export const createUserAgentDescriptor = (
  userAgentString: string,
): EditorInterface["userAgent"] => {
  const normalizedUA = userAgentString ?? "";
  let platform: EditorInterface["userAgent"]["platform"] = "unknown";

  if (isIOS) {
    platform = "ios";
  } else if (isAndroid) {
    platform = "android";
  } else if (normalizedUA) {
    platform = "other";
  }

  return {
    raw: normalizedUA,
    isMobileDevice: isMobileOrTablet(),
    platform,
  } as const;
};

import { isAndroid, isIOS, isMobileOrTablet } from "@excalidraw/common";

import type { EditorInterface, StylesPanelMode } from "./types";

export const DESKTOP_UI_MODE_STORAGE_KEY = "excalidraw.desktopUIMode";

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

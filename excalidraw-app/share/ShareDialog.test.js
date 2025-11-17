import { getShareIcon } from "./ShareDialog";
import { share, shareIOS, shareWindows } from "@excalidraw/excalidraw/components/icons";


jest.mock("@excalidraw/excalidraw/components/icons", () => ({
  share: "default-share-icon",
  shareIOS: "apple-share-icon",
  shareWindows: "windows-share-icon",
}));

describe("getShareIcon", () => {
  const originalPlatform = window.navigator.platform;

  afterEach(() => {
    Object.defineProperty(window.navigator, "platform", {
      value: originalPlatform,
      writable: true,
    });
  });

  it("should return default share icon for other platforms (e.g., Linux)", () => {
    Object.defineProperty(window.navigator, "platform", {
      value: "Linux x86_64",
      writable: true,
    });
    expect(getShareIcon()).toBe(share);
  });

  it("should return iOS share icon for Apple platforms (e.g., MacIntel)", () => {
  Object.defineProperty(window.navigator, "platform", {
    value: "MacIntel",
    writable: true,
  });
  expect(getShareIcon()).toBe(shareIOS);
  });

  it("should return Windows share icon for Windows platforms (e.g., Win32)", () => {
  Object.defineProperty(window.navigator, "platform", {
    value: "Win32",
    writable: true,
  });
  expect(getShareIcon()).toBe(shareWindows);
  });
});
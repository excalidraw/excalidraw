import { describe, it, expect, afterEach } from "vitest";

import { LocalData } from "../data/LocalData";

describe("LocalData shared link save lock", () => {
  afterEach(() => {
    LocalData.resumeSave("sharedLink");
    LocalData.resumeSave("collaboration");
  });

  it("isSharedLinkSaveLocked is true only while sharedLink pause is active", () => {
    expect(LocalData.isSharedLinkSaveLocked()).toBe(false);

    LocalData.pauseSave("sharedLink");
    expect(LocalData.isSharedLinkSaveLocked()).toBe(true);

    LocalData.resumeSave("sharedLink");
    expect(LocalData.isSharedLinkSaveLocked()).toBe(false);
  });

  it("isSavePaused reflects sharedLink lock (when tab is visible)", () => {
    const hiddenDesc = Object.getOwnPropertyDescriptor(document, "hidden");
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    });

    expect(LocalData.isSavePaused()).toBe(false);

    LocalData.pauseSave("sharedLink");
    expect(LocalData.isSavePaused()).toBe(true);

    LocalData.resumeSave("sharedLink");
    expect(LocalData.isSavePaused()).toBe(false);

    if (hiddenDesc) {
      Object.defineProperty(document, "hidden", hiddenDesc);
    } else {
      delete (document as { hidden?: boolean }).hidden;
    }
  });
});

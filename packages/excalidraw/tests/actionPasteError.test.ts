import { afterEach, describe, expect, it, vi } from "vitest";

import { t } from "../i18n";
import { actionPaste } from "../actions/actionClipboard";

const deniedError = () => {
  const error = new Error("Clipboard read blocked");
  error.name = "NotAllowedError";
  return error;
};

const mockClipboard = (permissionState: PermissionState | "unsupported") => {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: {
      read: vi.fn().mockRejectedValue(deniedError()),
      readText: vi.fn().mockRejectedValue(deniedError()),
    },
  });
  if (permissionState === "unsupported") {
    Object.defineProperty(navigator, "permissions", {
      configurable: true,
      value: undefined,
    });
  } else {
    Object.defineProperty(navigator, "permissions", {
      configurable: true,
      value: {
        query: vi.fn().mockResolvedValue({ state: permissionState }),
      },
    });
  }
};

const runPaste = () =>
  actionPaste.perform([], {} as any, null, {} as any) as Promise<any>;

describe("actionPaste when reading the clipboard fails", () => {
  afterEach(() => {
    Reflect.deleteProperty(navigator, "clipboard");
    Reflect.deleteProperty(navigator, "permissions");
  });

  it("shows an error when clipboard access is blocked for the site", async () => {
    mockClipboard("denied");

    const result = await runPaste();

    expect(result.appState.errorMessage).toBe(
      t("errors.asyncPasteFailedOnRead"),
    );
  });

  it("stays silent when the user dismissed the permission prompt", async () => {
    mockClipboard("prompt");

    const result = await runPaste();

    expect(result).toBe(false);
  });

  it("stays silent when the permissions API isn't available", async () => {
    mockClipboard("unsupported");

    const result = await runPaste();

    expect(result).toBe(false);
  });
});

import React from "react";
import { vi } from "vitest";

import { CaptureUpdateAction } from "@excalidraw/element";

import * as clipboard from "../clipboard";
import { t } from "../i18n";
import { Excalidraw } from "../index";
import { act, render, waitFor } from "../tests/test-utils";

import { actionPaste } from "./actionClipboard";

const { h } = window;

describe("actionPaste clipboard read errors", () => {
  let navigator: Navigator;
  let permissionsDescriptor: PropertyDescriptor | undefined;
  const query = vi.fn();

  const performPaste = () =>
    actionPaste.perform(
      h.app.scene.getElementsIncludingDeleted(),
      h.state,
      null,
      h.app,
    );

  beforeEach(async () => {
    await render(<Excalidraw />);
    navigator = h.app.ownerWindow.navigator;
    permissionsDescriptor = Object.getOwnPropertyDescriptor(
      navigator,
      "permissions",
    );
    query.mockReset();
    Object.defineProperty(navigator, "permissions", {
      configurable: true,
      value: { query },
    });
    vi.spyOn(clipboard, "readSystemClipboard").mockRejectedValue(
      new h.app.ownerWindow.DOMException(
        "Clipboard access blocked",
        "NotAllowedError",
      ),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (permissionsDescriptor) {
      Object.defineProperty(navigator, "permissions", permissionsDescriptor);
    } else {
      Reflect.deleteProperty(navigator, "permissions");
    }
  });

  it("keeps AbortError silent without querying permission", async () => {
    vi.mocked(clipboard.readSystemClipboard).mockRejectedValue(
      new h.app.ownerWindow.DOMException("Paste aborted", "AbortError"),
    );
    query.mockResolvedValue({ state: "denied" });

    await expect(performPaste()).resolves.toBe(false);
    expect(query).not.toHaveBeenCalled();
  });

  it("displays the existing read error when permission is denied", async () => {
    query.mockResolvedValue({ state: "denied" });

    await act(async () => {
      h.app.actionManager.executeAction(actionPaste, "contextMenu");
    });

    await waitFor(() => {
      expect(h.state.errorMessage).toBe(t("errors.asyncPasteFailedOnRead"));
    });
    expect(query).toHaveBeenCalledWith({ name: "clipboard-read" });
  });

  it.each(["prompt", "granted"])(
    "keeps NotAllowedError silent when permission is %s",
    async (state) => {
      query.mockResolvedValue({ state });

      await expect(performPaste()).resolves.toBe(false);
      expect(query).toHaveBeenCalledWith({ name: "clipboard-read" });
    },
  );

  it("stays silent when the Permissions API is unavailable", async () => {
    Object.defineProperty(navigator, "permissions", { value: undefined });

    await expect(performPaste()).resolves.toBe(false);
  });

  it("handles an unsupported clipboard-read permission query", async () => {
    query.mockRejectedValue(new TypeError("Unsupported permission name"));

    await expect(performPaste()).resolves.toBe(false);
  });

  it("handles a permission query that throws synchronously", async () => {
    query.mockImplementation(() => {
      throw new TypeError("Unsupported permission name");
    });

    await expect(performPaste()).resolves.toBe(false);
  });

  it("pastes successfully without querying permission", async () => {
    vi.mocked(clipboard.readSystemClipboard).mockResolvedValue({
      "text/plain": "Pasted text",
    });
    const paste = vi
      .spyOn(h.app.clipboard, "pasteFromClipboard")
      .mockResolvedValue(undefined);

    await expect(performPaste()).resolves.toEqual({
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    });
    expect(paste).toHaveBeenCalledTimes(1);
    expect(query).not.toHaveBeenCalled();
  });
});

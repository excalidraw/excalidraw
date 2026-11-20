import { vi } from "vitest";

import { Excalidraw } from "../index";

import { Pointer } from "./helpers/ui";
import {
  fireEvent,
  GlobalTestState,
  queryByText,
  render,
  unmountComponent,
  waitFor,
} from "./test-utils";

const { h } = window;

const mouse = new Pointer("mouse");

const stubClipboardReadError = (errorName: string) => {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: {
      read: vi.fn().mockRejectedValue(
        Object.assign(new Error(errorName), { name: errorName }),
      ),
    },
  });
};

const stubClipboardPermission = (state: string | null) => {
  Object.defineProperty(navigator, "permissions", {
    configurable: true,
    value: state
      ? {
          query: vi.fn().mockResolvedValue({ state }),
        }
      : undefined,
  });
};

beforeEach(async () => {
  unmountComponent();
  localStorage.clear();
  mouse.reset();

  await render(<Excalidraw handleKeyboardGlobally={true} />);
});

afterEach(() => {
  vi.restoreAllMocks();
});

const openContextMenuAndPaste = async () => {
  fireEvent.contextMenu(GlobalTestState.interactiveCanvas, {
    button: 2,
    clientX: 1,
    clientY: 1,
  });
  const contextMenu = await waitFor(() => {
    const menu = document.querySelector(".context-menu");
    if (!menu) {
      throw new Error("context menu not open");
    }
    return menu;
  });
  fireEvent.click(queryByText(contextMenu as HTMLElement, "Paste")!);
  await waitFor(() => {
    if (h.state.contextMenu) {
      throw new Error("context menu still open");
    }
  });
};

describe("paste error reporting", () => {
  it("shows an error when clipboard access is blocked for the site", async () => {
    stubClipboardReadError("NotAllowedError");
    stubClipboardPermission("denied");

    await openContextMenuAndPaste();

    await waitFor(() => {
      expect(h.state.errorMessage).toBe(
        "Couldn't paste (couldn't read from system clipboard).",
      );
    });
  });

  it("shows no error for a dismissed permission prompt", async () => {
    stubClipboardReadError("NotAllowedError");
    stubClipboardPermission("prompt");

    await openContextMenuAndPaste();

    // give the action a chance to (incorrectly) set an error
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(h.state.errorMessage).toBe(null);
  });

  it("shows no error when the Permissions API is unavailable", async () => {
    stubClipboardReadError("NotAllowedError");
    stubClipboardPermission(null);

    await openContextMenuAndPaste();

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(h.state.errorMessage).toBe(null);
  });

  it("shows no error when the user aborts the paste", async () => {
    stubClipboardReadError("AbortError");
    stubClipboardPermission("prompt");

    await openContextMenuAndPaste();

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(h.state.errorMessage).toBe(null);
  });
});

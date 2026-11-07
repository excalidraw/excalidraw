import { API } from "@excalidraw/excalidraw/tests/helpers/api";
import { render, waitFor } from "@excalidraw/excalidraw/tests/test-utils";
import { vi } from "vitest";

import ExcalidrawApp from "../App";
import { STORAGE_KEYS } from "../app_constants";

const { h } = window;

vi.mock(
  "@excalidraw/excalidraw/components/OverwriteConfirm/OverwriteConfirmState",
  async (importOriginal) => {
    const actual = await importOriginal<
      typeof import("@excalidraw/excalidraw/components/OverwriteConfirm/OverwriteConfirmState")
    >();
    return {
      ...actual,
      openConfirmModal: async () => true,
    };
  },
);

describe("share link", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it("should keep the local scene when the shared scene can't be fetched", async () => {
    const rectangle = API.createElement({ type: "rectangle" });
    localStorage.setItem(
      STORAGE_KEYS.LOCAL_STORAGE_ELEMENTS,
      JSON.stringify([rectangle]),
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 503 })),
    );
    vi.stubGlobal("alert", vi.fn());

    await render(<ExcalidrawApp />);

    await waitFor(() => {
      expect(h.elements.map((element) => element.id)).toEqual([rectangle.id]);
    });

    window.location.hash = "#json=abc123,def456";

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalled();
      expect(h.state.isLoading).toBe(false);
    });
    expect(h.elements.map((element) => element.id)).toEqual([rectangle.id]);
  });
});

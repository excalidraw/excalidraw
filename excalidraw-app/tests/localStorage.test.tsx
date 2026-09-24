import { Excalidraw } from "@excalidraw/excalidraw";
import { API } from "@excalidraw/excalidraw/tests/helpers/api";
import { render } from "@excalidraw/excalidraw/tests/test-utils";

import { STORAGE_KEYS } from "../app_constants";
import { importFromLocalStorage } from "../data/localStorage";

describe("importFromLocalStorage", () => {
  it("preserves transient app state when applying cross-tab updates", async () => {
    await render(
      <Excalidraw
        initialData={{
          appState: {
            openDialog: { name: "help" },
          },
        }}
      />,
    );

    localStorage.setItem(
      STORAGE_KEYS.LOCAL_STORAGE_APP_STATE,
      JSON.stringify({
        openDialog: null,
        viewBackgroundColor: "#f8f9fa",
      }),
    );

    const { appState } = importFromLocalStorage();

    expect(appState).not.toHaveProperty("openDialog");

    API.updateScene({
      appState: {
        ...window.h.state,
        ...appState,
      },
    });

    expect(window.h.state.openDialog).toEqual({ name: "help" });
    expect(window.h.state.viewBackgroundColor).toBe("#f8f9fa");
  });
});

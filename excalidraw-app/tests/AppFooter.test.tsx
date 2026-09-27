import { Excalidraw } from "@excalidraw/excalidraw";
import { UI } from "@excalidraw/excalidraw/tests/helpers/ui";
import {
  act,
  mockBoundingClientRect,
  render,
  restoreOriginalGetBoundingClientRect,
  waitFor,
} from "@excalidraw/excalidraw/tests/test-utils";

import { AppFooter } from "../components/AppFooter";
import {
  getExcalidrawComBadgeUrl,
  MobileExcalidrawComBadge,
} from "../components/ExcalidrawComBadge";

describe("AppFooter", () => {
  it("always shows a clickable excalidraw.com badge", async () => {
    await render(
      <Excalidraw>
        <AppFooter onChange={() => {}} />
      </Excalidraw>,
    );

    const badge = document.querySelector<HTMLAnchorElement>(
      "a.excalidraw-com-badge",
    );

    expect(badge).not.toBeNull();
    expect(badge!.textContent).toBe("excalidraw.com");
    // opens the Excalidraw it runs on (excalidraw.com in production)
    expect(badge!.getAttribute("href")).toBe(getExcalidrawComBadgeUrl());
    expect(badge!.getAttribute("href")).toBe(
      `${window.location.origin}/?utm_source=excalidraw&utm_medium=app&utm_content=canvasBadge`,
    );
    expect(badge!.getAttribute("href")).toContain("utm_content=canvasBadge");
    expect(badge!.target).toBe("_blank");
    expect(badge!.rel).toContain("noopener");
  });
});

describe("MobileExcalidrawComBadge", () => {
  const { h } = window;

  beforeAll(() => {
    // same phone-sized setup as Excalidraw's own mobile menu tests
    mockBoundingClientRect({ height: 400, width: 800 });
  });

  afterAll(() => {
    restoreOriginalGetBoundingClientRect();
  });

  it("shows on phones and steps aside while style buttons are showing", async () => {
    await render(
      <Excalidraw>
        <MobileExcalidrawComBadge />
      </Excalidraw>,
    );
    await act(async () => {
      h.app.refreshEditorInterface();
      // redraw the editor so it switches to the phone layout
      h.setState({});
    });
    expect(h.app.editorInterface.formFactor).toBe("phone");

    const getBadge = () =>
      document.querySelector<HTMLAnchorElement>(
        ".excalidraw-com-badge-mobile a.excalidraw-com-badge",
      );

    await waitFor(() => expect(getBadge()).not.toBeNull());
    expect(getBadge()!.getAttribute("href")).toBe(getExcalidrawComBadgeUrl());

    // a drawing tool fills the row with style buttons
    UI.clickTool("rectangle");
    await waitFor(() => expect(getBadge()).toBeNull());

    UI.clickTool("selection");
    await waitFor(() => expect(getBadge()).not.toBeNull());
  });
});

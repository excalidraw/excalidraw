import ExcalidrawApp from "../excalidraw-app";
import {
  mockBoundingClientRect,
  render,
  restoreOriginalGetBoundingClientRect,
  screen,
} from "./test-utils";

import { UI } from "./helpers/ui";

describe("Test MobileMenu", () => {
  const { h } = window;
  const dimensions = { height: 400, width: 800 };

  beforeEach(async () => {
    await render(<ExcalidrawApp />);
    mockBoundingClientRect(dimensions);
    //@ts-ignore
    h.app.refreshDeviceState(h.app.excalidrawContainerRef.current!);
    // To rerender the UI after device updated
    h.app.updateDOMRect();
  });

  afterAll(() => {
    restoreOriginalGetBoundingClientRect();
  });

  it("should set device correctly", () => {
    expect(h.app.device).toMatchInlineSnapshot(`
      {
        "canDeviceFitSidebar": false,
        "isLandscape": true,
        "isMobile": true,
        "isSmScreen": false,
        "isTouchScreen": false,
      }
    `);
  });

  it.only("should initialize with welcome screen and hide once user interacts", async () => {
    expect(document.querySelector(".welcome-screen-center")).toMatchSnapshot();
    UI.clickTool("rectangle");
    expect(document.querySelector(".welcome-screen-center")).toBeNull();
  });
});

import ExcalidrawApp from "../../excalidraw-app";
import {
  mockBoundingClientRect,
  render,
  restoreOriginalGetBoundingClientRect,
} from "../../src/tests/test-utils";

import { UI } from "../../src/tests/helpers/ui";

describe("Test MobileMenu", () => {
  const { h } = window;
  const dimensions = { height: 400, width: 800 };

  beforeAll(() => {
    mockBoundingClientRect(dimensions);
  });

  beforeEach(async () => {
    await render(<ExcalidrawApp />);
    //@ts-ignore
    h.app.refreshDeviceState(h.app.excalidrawContainerRef.current!);
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

  it("should initialize with welcome screen and hide once user interacts", async () => {
    expect(document.querySelector(".welcome-screen-center")).toMatchSnapshot();
    UI.clickTool("rectangle");
    expect(document.querySelector(".welcome-screen-center")).toBeNull();
  });
});

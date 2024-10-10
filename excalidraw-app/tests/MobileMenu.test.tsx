import ExcalidrawApp from "../App";
import {
  mockBoundingClientRect,
  render,
  restoreOriginalGetBoundingClientRect,
} from "../../packages/excalidraw/tests/test-utils";

import { UI } from "../../packages/excalidraw/tests/helpers/ui";

describe("Test MobileMenu", () => {
  const { h } = window;
  const dimensions = { height: 400, width: 800 };

  beforeAll(() => {
    mockBoundingClientRect(dimensions);
  });

  beforeEach(async () => {
    await render(
      <ExcalidrawApp
        firebaseConfig={{
          apiKey: "",
          authDomain: "",
          databaseURL: "",
          projectId: "",
          storageBucket: "",
        }}
        collabServerUrl="https://test.com"
        roomLinkData={null}
        username={""}
<<<<<<< HEAD
        theme="dark"
        excalidrawAPIRefCallback={() => {}}
        firebaseToken=""
        onCollabRoomSave={() => Promise.resolve()}
      />,
    ); // @ts-ignore
=======
        firebaseToken=""
        theme="dark"
        excalidrawAPIRefCallback={() => {}}
        onCollabRoomSave={() => Promise.resolve()}
      />,
    );
    // @ts-ignore
>>>>>>> karat
    h.app.refreshViewportBreakpoints();
    // @ts-ignore
    h.app.refreshEditorBreakpoints();
  });

  afterAll(() => {
    restoreOriginalGetBoundingClientRect();
  });

  it("should set device correctly", () => {
    expect(h.app.device).toMatchInlineSnapshot(`
      {
        "editor": {
          "canFitSidebar": false,
          "isMobile": true,
        },
        "isTouchScreen": false,
        "viewport": {
          "isLandscape": false,
          "isMobile": true,
        },
      }
    `);
  });

  it("should initialize with welcome screen and hide once user interacts", async () => {
    expect(document.querySelector(".welcome-screen-center")).toMatchSnapshot();
    UI.clickTool("rectangle");
    expect(document.querySelector(".welcome-screen-center")).toBeNull();
  });
});

import { UI } from "@excalidraw/excalidraw/tests/helpers/ui";
import {
  mockBoundingClientRect,
  render,
  restoreOriginalGetBoundingClientRect,
} from "@excalidraw/excalidraw/tests/test-utils";

import ExcalidrawApp from "../App";

describe("Test MobileMenu", () => {
  const { h } = window;
  const dimensions = { height: 400, width: 800 };

  beforeAll(() => {
    mockBoundingClientRect(dimensions);
  });

  beforeEach(async () => {
    await render(<ExcalidrawApp />);
    // @ts-ignore
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
    expect(document.querySelector(".welcome-screen-center")).toMatchInlineSnapshot(`
      <div
        class="welcome-screen-center"
      >
        <div
          class="welcome-screen-center__logo excalifont welcome-screen-decor"
        >
          <div
            class="GamifyBoardLogo is-normal"
          >
            <svg
              height="483.95673"
              id="svg1"
              version="1.1"
              viewBox="0 0 2818.8557 483.95673"
              width="2818.8557"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs
                id="defs1"
              >
                <rect
                  height="743.77161"
                  id="rect4"
                  width="2068.9421"
                  x="1367.0731"
                  y="1131.3708"
                />
              </defs>
              <g
                id="layer1"
                transform="translate(-302.25031,-242.30083)"
              >
                <path
                  d="m 438.49277,242.30083 -136.24246,235.9784 136.24246,235.9784 h 272.48345 l 135.5834,-234.837 H 574.73441 v 79.7492 h 134.07591 l -43.687,75.6673 H 484.3455 l -90.38896,-156.5579 90.38896,-156.5579 h 180.77782 l 45.1946,78.2789 h 91.7063 l -91.048,-157.6994 z"
                  id="path2"
                  style="stroke-width: 11.4716px;"
                />
                <text
                  id="text4"
                  style="font-size: 192px; font-family: 'Baloo 2'; white-space: pre; fill: #000000; stroke-width: 29.3065px;"
                  transform="matrix(2.3631793,0,0,2.3631793,-2344.6075,-2392.9794)"
                  xml:space="preserve"
                >
                  <tspan
                    id="tspan1"
                    x="1367.0723"
                    y="1283.4524"
                  >
                    amifyBoard
                  </tspan>
                </text>
              </g>
            </svg>
          </div>
        </div>
        <div
          class="welcome-screen-center__heading welcome-screen-decor excalifont"
        >
          Diagrams. Made. Simple.
        </div>
        <div
          class="welcome-screen-menu"
        >
          <button
            class="welcome-screen-menu-item "
            type="button"
          >
            <div
              class="welcome-screen-menu-item__icon"
            >
              <svg
                aria-hidden="true"
                class=""
                fill="none"
                focusable="false"
                role="img"
                stroke="currentColor"
                stroke-linecap="round"
                stroke-linejoin="round"
                viewBox="0 0 20 20"
              >
                <path
                  d="m9.257 6.351.183.183H15.819c.34 0 .727.182 1.051.506.323.323.505.708.505 1.05v5.819c0 .316-.183.7-.52 1.035-.337.338-.723.522-1.037.522H4.182c-.352 0-.74-.181-1.058-.5-.318-.318-.499-.705-.499-1.057V5.182c0-.351.181-.736.5-1.054.32-.321.71-.503 1.057-.503H6.53l2.726 2.726Z"
                  stroke-width="1.25"
                />
              </svg>
            </div>
            <div
              class="welcome-screen-menu-item__text"
            >
              Open
            </div>
            <div
              class="welcome-screen-menu-item__shortcut"
            >
              Ctrl+O
            </div>
          </button>
          <button
            class="welcome-screen-menu-item "
            type="button"
          >
            <div
              class="welcome-screen-menu-item__icon"
            >
              <svg
                aria-hidden="true"
                class=""
                fill="none"
                focusable="false"
                role="img"
                stroke="currentColor"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                viewBox="0 0 24 24"
              >
                <g
                  stroke-width="1.5"
                >
                  <path
                    d="M0 0h24v24H0z"
                    fill="none"
                    stroke="none"
                  />
                  <circle
                    cx="12"
                    cy="12"
                    r="9"
                  />
                  <line
                    x1="12"
                    x2="12"
                    y1="17"
                    y2="17.01"
                  />
                  <path
                    d="M12 13.5a1.5 1.5 0 0 1 1 -1.5a2.6 2.6 0 1 0 -3 -4"
                  />
                </g>
              </svg>
            </div>
            <div
              class="welcome-screen-menu-item__text"
            >
              Help
            </div>
            <div
              class="welcome-screen-menu-item__shortcut"
            >
              ?
            </div>
          </button>
        </div>
      </div>
    `);
    UI.clickTool("rectangle");
    expect(document.querySelector(".welcome-screen-center")).toBeNull();
  });
});

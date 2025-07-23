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

  it.skip("should initialize with welcome screen and hide once user interacts", () => {
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
            class="welcome-screen-menu-item welcome-screen-menu-item--primary"
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
                  <path
                    d="M4 21v-13a3 3 0 0 1 3 -3h10a3 3 0 0 1 3 3v6a3 3 0 0 1 -3 3h-9l-4 4"
                  />
                  <line
                    x1="8"
                    x2="14"
                    y1="9"
                    y2="9"
                  />
                  <line
                    x1="8"
                    x2="14"
                    y1="13"
                    y2="13"
                  />
                </g>
              </svg>
            </div>
            <div
              class="welcome-screen-menu-item__text"
            >
              Canvas
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
                  <path
                    d="M14 3v4a1 1 0 0 0 1 1h4"
                  />
                  <path
                    d="M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z"
                  />
                  <line
                    x1="9"
                    x2="10"
                    y1="9"
                    y2="9"
                  />
                  <line
                    x1="9"
                    x2="15"
                    y1="13"
                    y2="13"
                  />
                  <line
                    x1="9"
                    x2="15"
                    y1="17"
                    y2="17"
                  />
                </g>
              </svg>
            </div>
            <div
              class="welcome-screen-menu-item__text"
            >
              Load session...
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
                    y1="8"
                    y2="12"
                  />
                  <line
                    x1="12"
                    x2="12.01"
                    y1="16"
                    y2="16"
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

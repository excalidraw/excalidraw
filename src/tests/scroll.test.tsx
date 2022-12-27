import {
  mockBoundingClientRect,
  render,
  restoreOriginalGetBoundingClientRect,
  waitFor,
} from "./test-utils";
import { Excalidraw } from "../packages/excalidraw/index";
import { API } from "./helpers/api";
import { Keyboard } from "./helpers/ui";
import { KEYS } from "../keys";
import ExcalidrawApp from "../excalidraw-app";

const { h } = window;

describe("appState", () => {
  it("scroll-to-content on init works with non-zero offsets", async () => {
    const WIDTH = 200;
    const HEIGHT = 100;
    const OFFSET_LEFT = 20;
    const OFFSET_TOP = 10;

    const ELEM_WIDTH = 100;
    const ELEM_HEIGHT = 60;

    mockBoundingClientRect();

    await render(
      <div>
        <Excalidraw
          initialData={{
            elements: [
              API.createElement({
                type: "rectangle",
                id: "A",
                width: ELEM_WIDTH,
                height: ELEM_HEIGHT,
              }),
            ],
            scrollToContent: true,
          }}
        />
      </div>,
    );
    await waitFor(() => {
      expect(h.state.width).toBe(200);
      expect(h.state.height).toBe(100);
      expect(h.state.offsetLeft).toBe(OFFSET_LEFT);
      expect(h.state.offsetTop).toBe(OFFSET_TOP);

      // assert scroll is in center
      expect(h.state.scrollX).toBe(WIDTH / 2 - ELEM_WIDTH / 2);
      expect(h.state.scrollY).toBe(HEIGHT / 2 - ELEM_HEIGHT / 2);
    });
    restoreOriginalGetBoundingClientRect();
  });
  it("zoomed canvas scrolls on page keys", async () => {
    mockBoundingClientRect();
    await render(<ExcalidrawApp />, {});

    const scrollTest = () => {
      const scrollY = h.state.scrollY;
      const pageStep = h.state.height / h.state.zoom.value;
      // Assert the following assertions have meaning
      expect(pageStep).toBeGreaterThan(0);
      // Assert we scroll up
      Keyboard.keyPress(KEYS.PAGE_UP);
      expect(h.state.scrollY).toBe(scrollY + pageStep);
      // Assert we scroll down
      Keyboard.keyPress(KEYS.PAGE_DOWN);
      Keyboard.keyPress(KEYS.PAGE_DOWN);
      expect(h.state.scrollY).toBe(scrollY - pageStep);
    };
    const zoom = h.state.zoom.value;
    // Assert we scroll properly when zoomed in
    h.setState({ zoom: { value: (zoom * 1.1) as typeof zoom } });
    scrollTest();
    // Assert we scroll properly when zoomed out
    h.setState({ zoom: { value: (zoom * 0.9) as typeof zoom } });
    scrollTest();
    // Assert we scroll properly with normal zoom
    h.setState({ zoom: { value: zoom } });
    scrollTest();
    restoreOriginalGetBoundingClientRect();
  });
});

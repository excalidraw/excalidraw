import { vi } from "vitest";

import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { Pointer } from "./helpers/ui";
import {
  mockBoundingClientRect,
  render,
  restoreOriginalGetBoundingClientRect,
  waitFor,
} from "./test-utils";

const { h } = window;

const mouse = new Pointer("mouse");

describe("embeddables", () => {
  beforeEach(() => {
    mockBoundingClientRect();
  });

  afterEach(() => {
    restoreOriginalGetBoundingClientRect();
  });

  it("renders multiple embeds allowed by the same global regex", async () => {
    await render(
      <Excalidraw
        viewModeEnabled
        validateEmbeddable={/^https:\/\/example\.com\//g}
      />,
    );

    API.setElements(
      [20, 80].map((x) => ({
        ...API.createElement({
          type: "embeddable",
          x,
          y: 20,
          width: 50,
          height: 50,
        }),
        link: "https://example.com/embed",
      })),
    );

    await waitFor(() => {
      expect(
        document.querySelectorAll("iframe.excalidraw__embeddable"),
      ).toHaveLength(2);
    });
  });

  it("autoplays a Google Drive video on first activation only", async () => {
    await render(<Excalidraw viewModeEnabled />);
    await waitFor(() => expect(h.state.width).toBe(200));

    // link set upfront: embeds are validated (and cached) once per element
    API.setElements([
      {
        ...API.createElement({
          type: "embeddable",
          x: 20,
          y: 20,
          width: 120,
          height: 90,
        }),
        link: "https://drive.google.com/file/d/aaa/view",
      },
    ]);

    const iframe = await waitFor(() => {
      const iframe = document.querySelector("iframe.excalidraw__embeddable");
      expect(iframe).not.toBe(null);
      return iframe!;
    });
    // jsdom's `location.replace` can't be spied on
    const replace = vi.fn();
    Object.defineProperty(iframe, "contentWindow", {
      value: { location: { replace } },
    });

    const activate = async () => {
      mouse.clickAt(80, 65);
      await waitFor(() => {
        expect(h.state.activeEmbeddable?.state).toBe("active");
      });
    };

    await activate();
    // replace (not `src`) so the reload doesn't add a history entry
    expect(replace).toHaveBeenCalledWith(
      "https://drive.google.com/file/d/aaa/preview?autoplay=1",
    );

    // re-activating must not reload (and restart) the video
    mouse.clickAt(5, 5);
    expect(h.state.activeEmbeddable).toBe(null);
    await activate();
    expect(replace).toHaveBeenCalledTimes(1);
  });
});

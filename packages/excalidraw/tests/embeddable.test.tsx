import { vi } from "vitest";

import { normalizeLink } from "@excalidraw/common";

import { Excalidraw } from "../index";
import { t } from "../i18n";

import { API } from "./helpers/api";
import { Pointer } from "./helpers/ui";
import {
  fireEvent,
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

  it.each([
    [
      '  <iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe>  ',
      "https://www.youtube.com/embed/dQw4w9WgXcQ",
    ],
    [
      '<blockquote class="instagram-media"><a href="https://www.instagram.com/p/test/">View post</a></blockquote>',
      "https://www.instagram.com/p/test/",
    ],
    [
      '<script src="https://gist.github.com/user/abc123.js"></script>',
      "https://gist.github.com/user/abc123",
    ],
    ["https://youtu.be/dQw4w9WgXcQ", "https://youtu.be/dQw4w9WgXcQ"],
  ])(
    "extracts the embed URL when the link editor submits %s",
    async (input, url) => {
      const { getByPlaceholderText, container } = await render(<Excalidraw />);
      const element = API.createElement({ type: "embeddable" });
      API.setElements([element]);
      API.setSelectedElements([element]);
      API.setAppState({ showHyperlinkPopup: "editor" });

      const editor = getByPlaceholderText(t("labels.link.hint"));
      fireEvent.change(editor, { target: { value: input } });
      fireEvent.keyDown(editor, { key: "Enter" });

      expect(h.elements[0].link).toBe(url);
      expect(h.state.toast).toBe(null);
      expect(container.querySelector("iframe.excalidraw__embeddable")).not.toBe(
        null,
      );
    },
  );

  it("validates the extracted URL with the host's embed policy", async () => {
    const validateEmbeddable = vi.fn(() => false);
    const { getByPlaceholderText, container } = await render(
      <Excalidraw validateEmbeddable={validateEmbeddable} />,
    );
    const element = API.createElement({ type: "embeddable" });
    API.setElements([element]);
    API.setSelectedElements([element]);
    API.setAppState({ showHyperlinkPopup: "editor" });

    const editor = getByPlaceholderText(t("labels.link.hint"));
    fireEvent.change(editor, {
      target: { value: '<iframe src="https://excalidraw.com"></iframe>' },
    });
    fireEvent.keyDown(editor, { key: "Enter" });

    expect(validateEmbeddable).toHaveBeenCalledWith("https://excalidraw.com");
    expect(h.state.toast?.message).toBe(t("toast.unableToEmbed"));
    expect(container.querySelector("iframe.excalidraw__embeddable")).toBe(null);
  });

  it("does not extract embed HTML for ordinary element hyperlinks", async () => {
    const { getByPlaceholderText } = await render(<Excalidraw />);
    const element = API.createElement({ type: "rectangle" });
    API.setElements([element]);
    API.setSelectedElements([element]);
    API.setAppState({ showHyperlinkPopup: "editor" });

    const input = '<iframe src="https://excalidraw.com"></iframe>';
    const editor = getByPlaceholderText(t("labels.link.hint"));
    fireEvent.change(editor, { target: { value: input } });
    fireEvent.keyDown(editor, { key: "Enter" });

    expect(h.elements[0].link).toBe(normalizeLink(input));
  });
});

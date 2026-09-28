import React from "react";

import {
  IFRAME_ELEMENT_CSP,
  IFRAME_ELEMENT_PERMISSIONS_POLICY,
  injectIframeElementCSP,
} from "@excalidraw/element";

import { DiagramToCodeError, DiagramToCodePlugin, Excalidraw } from "../index";
import { t } from "../i18n";

import { API } from "./helpers/api";
import {
  act,
  fireEvent,
  mockBoundingClientRect,
  render,
  restoreOriginalGetBoundingClientRect,
  unmountComponent,
  waitFor,
} from "./test-utils";

const getSandboxTokens = (iframe: HTMLIFrameElement) =>
  (iframe.getAttribute("sandbox") ?? "").split(/\s+/).filter(Boolean);

describe("embeddable & iframe sandbox", () => {
  beforeEach(() => {
    unmountComponent();
    // embeds render only when within the viewport, which is 0x0 in jsdom
    // unless we mock the container dimensions
    mockBoundingClientRect({ width: 1920, height: 1080 });
  });

  afterEach(() => {
    restoreOriginalGetBoundingClientRect();
  });

  it("renders iframe elements with a restricted sandbox", async () => {
    const iframeElement = {
      ...API.createElement({
        type: "iframe",
        x: 10,
        y: 10,
        width: 300,
        height: 200,
      }),
      customData: {
        generationData: { status: "done", html: "<p>hi</p>" },
      },
    };

    const { container } = await render(
      <Excalidraw initialData={{ elements: [iframeElement] }} />,
    );

    const iframe = await waitFor(() => {
      const iframe = container.querySelector<HTMLIFrameElement>(
        "iframe.excalidraw__embeddable",
      );
      expect(iframe).not.toBeNull();
      return iframe!;
    });

    const srcdoc = iframe.getAttribute("srcdoc");
    expect(srcdoc).toBe(injectIframeElementCSP("<p>hi</p>"));
    expect(srcdoc).toContain(
      `<meta http-equiv="Content-Security-Policy" content="${IFRAME_ELEMENT_CSP}">`,
    );
    expect(IFRAME_ELEMENT_CSP).toContain("frame-src 'none'");
    expect(IFRAME_ELEMENT_CSP).toContain("child-src 'none'");
    expect(IFRAME_ELEMENT_CSP).toContain("form-action 'none'");
    // also enforced across navigations (Chromium)
    expect(iframe.getAttribute("csp")).toBe(IFRAME_ELEMENT_CSP);

    const allow = iframe.getAttribute("allow");
    expect(allow).toBe(IFRAME_ELEMENT_PERMISSIONS_POLICY);
    expect(allow).toContain("clipboard-write 'none'");
    expect(allow).toContain("clipboard-read 'none'");
    expect(allow).toContain("fullscreen 'none'");
    expect(allow).toContain("autoplay 'none'");
    expect(iframe.hasAttribute("allowfullscreen")).toBe(false);

    const tokens = getSandboxTokens(iframe);
    expect(tokens).toContain("allow-scripts");
    expect(tokens).not.toContain("allow-popups");
    expect(tokens).not.toContain("allow-popups-to-escape-sandbox");
    expect(tokens).not.toContain("allow-downloads");
    expect(tokens).not.toContain("allow-same-origin");
  });

  it("keeps the embeddable sandbox unchanged", async () => {
    const embeddable = {
      ...API.createElement({
        type: "embeddable",
        x: 10,
        y: 10,
        width: 300,
        height: 200,
      }),
      link: "https://www.youtube.com/watch?v=gkGMXY0wekg",
    };

    const { container } = await render(
      <Excalidraw initialData={{ elements: [embeddable] }} />,
    );

    const iframe = await waitFor(() => {
      const iframe = container.querySelector<HTMLIFrameElement>(
        "iframe.excalidraw__embeddable",
      );
      expect(iframe).not.toBeNull();
      return iframe!;
    });

    expect(iframe.hasAttribute("csp")).toBe(false);
    expect(iframe.getAttribute("allow")).toContain("clipboard-write");
    expect(iframe.getAttribute("allow")).not.toContain("'none'");
    expect(iframe.hasAttribute("allowfullscreen")).toBe(true);
    expect(iframe.getAttribute("referrerpolicy")).toBe(
      "no-referrer-when-downgrade",
    );

    const tokens = getSandboxTokens(iframe);
    expect(tokens).toContain("allow-scripts");
    expect(tokens).toContain("allow-popups");
    expect(tokens).toContain("allow-popups-to-escape-sandbox");
  });

  describe("iframe element fullscreen button", () => {
    const h = window.h;
    const originalFullscreenElement = Object.getOwnPropertyDescriptor(
      document,
      "fullscreenElement",
    );
    let fullscreenElement: Element | null = null;

    beforeEach(() => {
      fullscreenElement = null;
      Object.defineProperty(document, "fullscreenElement", {
        configurable: true,
        get: () => fullscreenElement,
      });
    });

    afterEach(() => {
      if (originalFullscreenElement) {
        Object.defineProperty(
          document,
          "fullscreenElement",
          originalFullscreenElement,
        );
      } else {
        delete (document as any).fullscreenElement;
      }
      vi.restoreAllMocks();
    });

    const renderSelectedDoneIframe = async () => {
      const iframeElement = {
        ...API.createElement({
          type: "iframe",
          x: 10,
          y: 10,
          width: 300,
          height: 200,
        }),
        customData: {
          generationData: { status: "done", html: "<p>hi</p>" },
        },
      };

      const { container } = await render(
        <Excalidraw initialData={{ elements: [iframeElement] }} />,
      );

      const iframe = await waitFor(() => {
        const iframe = container.querySelector<HTMLIFrameElement>(
          "iframe.excalidraw__embeddable",
        );
        expect(iframe).not.toBeNull();
        return iframe!;
      });

      API.setAppState({ selectedElementIds: { [iframeElement.id]: true } });

      const button = await waitFor(() => {
        const button = container.querySelector<HTMLButtonElement>(
          `.excalidraw-canvas-buttons button[aria-label="${t(
            "buttons.fullScreen",
          )}"]`,
        );
        expect(button).not.toBeNull();
        return button!;
      });

      return { iframe, button, element: h.elements[0] };
    };

    it("is shown for a selected done iframe element and fullscreens its <iframe>", async () => {
      const { iframe, button, element } = await renderSelectedDoneIframe();

      const requestFullscreen = vi.fn(function (this: Element) {
        fullscreenElement = this;
        return Promise.resolve();
      });
      iframe.requestFullscreen = requestFullscreen;

      fireEvent.click(button);

      expect(requestFullscreen).toHaveBeenCalledTimes(1);
      expect(requestFullscreen.mock.instances[0]).toBe(iframe);

      await waitFor(() => {
        expect(h.state.activeEmbeddable).toEqual({
          element,
          state: "active",
        });
      });
      expect(h.state.errorMessage).toBe(null);
    });

    it("surfaces an error when requestFullscreen rejects", async () => {
      const { iframe, button } = await renderSelectedDoneIframe();

      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const requestFullscreen = vi.fn(() =>
        Promise.reject(new TypeError("Permissions check failed")),
      );
      iframe.requestFullscreen = requestFullscreen;

      expect(() => fireEvent.click(button)).not.toThrow();
      expect(requestFullscreen).toHaveBeenCalledTimes(1);

      await waitFor(() => {
        expect(h.state.errorMessage).toBe("Couldn't enter fullscreen");
      });
      expect(h.state.activeEmbeddable).toBe(null);
      expect(warn).toHaveBeenCalled();
    });
  });
});

describe("iframe element generation errors", () => {
  const h = window.h;

  beforeEach(() => {
    unmountComponent();
    mockBoundingClientRect({ width: 1920, height: 1080 });
  });

  afterEach(() => {
    restoreOriginalGetBoundingClientRect();
  });

  const createIframeElement = (generationData: any) => ({
    ...API.createElement({
      type: "iframe",
      x: 10,
      y: 10,
      width: 300,
      height: 200,
    }),
    customData: { generationData },
  });

  const waitForErrorOverlay = (container: HTMLElement) =>
    waitFor(() => {
      const overlay = container.querySelector<HTMLElement>(
        ".excalidraw__embeddable__error",
      );
      expect(overlay).not.toBeNull();
      return overlay!;
    });

  const getIframe = (container: HTMLElement) =>
    container.querySelector<HTMLIFrameElement>("iframe.excalidraw__embeddable");

  it("renders the error message as plain text in an app overlay, not in the frame", async () => {
    const payload = `<img src=x onerror=alert(1)><a href="https://evil.test">x</a>`;
    const { container } = await render(
      <Excalidraw
        initialData={{
          elements: [
            createIframeElement({
              status: "error",
              message: payload,
              code: "ERR_OAI",
            }),
          ],
        }}
      />,
    );

    const overlay = await waitForErrorOverlay(container);
    expect(
      overlay.querySelector(".excalidraw__embeddable__error__message")!
        .textContent,
    ).toBe(payload);
    expect(overlay.querySelector("img")).toBeNull();
    expect(overlay.querySelector("a")).toBeNull();

    // the frame renders an empty document (no error document)
    const srcdoc = getIframe(container)!.getAttribute("srcdoc")!;
    expect(srcdoc).toBe(injectIframeElementCSP("<html><body></body></html>"));
    expect(srcdoc).not.toContain("img");
  });

  it("doesn't crash on non-string error data", async () => {
    const { container } = await render(
      <Excalidraw
        initialData={{
          elements: [
            createIframeElement({
              status: "error",
              message: { evil: true },
              code: { evil: true },
            }),
          ],
        }}
      />,
    );

    const overlay = await waitForErrorOverlay(container);
    expect(overlay.textContent).toContain("Generation failed");
  });

  it("uses the host-supplied renderer, and falls back when it returns null", async () => {
    const renderError = vi.fn(({ code }: { code: string }) =>
      code === "ERR_RATE_LIMIT" ? (
        <span className="host-rate-limit">rate limited</span>
      ) : null,
    );

    const { container } = await render(
      <Excalidraw
        initialData={{
          elements: [
            createIframeElement({
              status: "error",
              message: "Too many requests",
              code: "ERR_RATE_LIMIT",
            }),
            {
              ...createIframeElement({
                status: "error",
                message: "other error",
                code: "ERR_OAI",
              }),
              x: 400,
            },
          ],
        }}
      >
        <DiagramToCodePlugin
          generate={() => ({ html: "" })}
          renderError={renderError}
        />
      </Excalidraw>,
    );

    await waitFor(() => {
      const overlays = container.querySelectorAll<HTMLElement>(
        ".excalidraw__embeddable__error",
      );
      expect(overlays).toHaveLength(2);
      expect(overlays[0].querySelector(".host-rate-limit")).not.toBeNull();
      expect(overlays[0].textContent).toBe("rate limited");
      expect(overlays[1].querySelector(".host-rate-limit")).toBeNull();
      expect(overlays[1].textContent).toContain("other error");
    });
    expect(renderError).toHaveBeenCalledWith({
      code: "ERR_RATE_LIMIT",
      message: "Too many requests",
    });
  });

  it("falls back to the default error text when no renderer is supplied", async () => {
    const { container } = await render(
      <Excalidraw
        initialData={{
          elements: [
            createIframeElement({
              status: "error",
              message: "Too many requests",
              code: "ERR_RATE_LIMIT",
            }),
          ],
        }}
      >
        <DiagramToCodePlugin generate={() => ({ html: "" })} />
      </Excalidraw>,
    );

    const overlay = await waitForErrorOverlay(container);
    expect(overlay.textContent).toContain("Error!");
    expect(overlay.textContent).toContain("Too many requests");
  });

  it("doesn't render the overlay for done/pending generations", async () => {
    const { container } = await render(
      <Excalidraw
        initialData={{
          elements: [
            createIframeElement({ status: "done", html: "<p>hi</p>" }),
            {
              ...createIframeElement({ status: "pending" }),
              x: 400,
            },
          ],
        }}
      />,
    );

    await waitFor(() => {
      expect(
        container.querySelectorAll("iframe.excalidraw__embeddable"),
      ).toHaveLength(2);
      expect(
        container.querySelector(".excalidraw__embeddable__generating"),
      ).not.toBeNull();
    });
    expect(
      container.querySelector(".excalidraw__embeddable__error"),
    ).toBeNull();
  });

  it("stores the code of a DiagramToCodeError thrown by the host", async () => {
    const generate = vi.fn(async () => {
      throw new DiagramToCodeError("slow down", "ERR_RATE_LIMIT");
    });

    const { container } = await render(
      <Excalidraw>
        <DiagramToCodePlugin
          generate={generate}
          renderError={({ code }) =>
            code === "ERR_RATE_LIMIT" ? (
              <span className="host-rate-limit">rate limited</span>
            ) : null
          }
        />
      </Excalidraw>,
    );

    const magicFrame = API.createElement({
      type: "magicframe",
      x: 0,
      y: 0,
      width: 200,
      height: 200,
    });
    const rect = API.createElement({
      type: "rectangle",
      x: 10,
      y: 10,
      width: 50,
      height: 50,
      frameId: magicFrame.id,
    });
    API.setElements([magicFrame, rect]);

    await act(() => (h.app as any).onMagicFrameGenerate(magicFrame, "button"));

    expect(generate).toHaveBeenCalled();
    const iframeElement = h.elements.find((el) => el.type === "iframe")!;
    expect(iframeElement.customData?.generationData).toEqual({
      status: "error",
      code: "ERR_RATE_LIMIT",
      message: "slow down",
    });

    const overlay = await waitForErrorOverlay(container);
    expect(overlay.querySelector(".host-rate-limit")).not.toBeNull();
  });

  it("stores a generic code for other thrown errors", async () => {
    await render(
      <Excalidraw>
        <DiagramToCodePlugin
          generate={async () => {
            throw Object.assign(new Error("boom"), { code: "ERR_RATE_LIMIT" });
          }}
        />
      </Excalidraw>,
    );

    const magicFrame = API.createElement({
      type: "magicframe",
      x: 0,
      y: 0,
      width: 200,
      height: 200,
    });
    const rect = API.createElement({
      type: "rectangle",
      x: 10,
      y: 10,
      width: 50,
      height: 50,
      frameId: magicFrame.id,
    });
    API.setElements([magicFrame, rect]);

    await act(() => (h.app as any).onMagicFrameGenerate(magicFrame, "button"));

    const iframeElement = h.elements.find((el) => el.type === "iframe")!;
    expect(iframeElement.customData?.generationData).toEqual({
      status: "error",
      code: "ERR_OAI",
      message: "boom",
    });
  });
});

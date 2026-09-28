import React from "react";
import { vi } from "vitest";

import {
  IFRAME_ELEMENT_CSP,
  IFRAME_ELEMENT_PERMISSIONS_POLICY,
  injectIframeElementCSP,
} from "@excalidraw/element";

import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { Pointer } from "./helpers/ui";
import {
  mockBoundingClientRect,
  render,
  restoreOriginalGetBoundingClientRect,
  unmountComponent,
  waitFor,
} from "./test-utils";

const { h } = window;

const mouse = new Pointer("mouse");

const getSandboxTokens = (iframe: HTMLIFrameElement) =>
  (iframe.getAttribute("sandbox") ?? "").split(/\s+/).filter(Boolean);

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
});

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
    expect(iframe.getAttribute("referrerpolicy")).toBe("no-referrer");

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

  describe("iframe element srcdoc", () => {
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

    const getIframe = (container: HTMLElement) =>
      container.querySelector<HTMLIFrameElement>(
        "iframe.excalidraw__embeddable",
      );

    const waitForIframe = (container: HTMLElement) =>
      waitFor(() => {
        const iframe = getIframe(container);
        expect(iframe).not.toBeNull();
        return iframe!;
      });

    it("escapes the error message", async () => {
      const payload = `<img src=x onerror=alert(1)>`;
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

      const srcdoc = (await waitForIframe(container)).getAttribute("srcdoc")!;
      expect(srcdoc).not.toContain(payload);
      expect(srcdoc).not.toContain("<img");
      expect(srcdoc).toContain("&lt;img src=x onerror=alert(1)&gt;");
      expect(srcdoc).toContain(
        `<meta http-equiv="Content-Security-Policy" content="${IFRAME_ELEMENT_CSP}">`,
      );
    });
  });
});

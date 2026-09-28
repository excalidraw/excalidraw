import React from "react";

import {
  IFRAME_ELEMENT_CSP,
  injectIframeElementCSP,
} from "@excalidraw/element";

import { act, fireEvent } from "@testing-library/react";

import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import {
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

    const load = (iframe: HTMLIFrameElement) =>
      act(() => {
        fireEvent.load(iframe);
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

    it("resets the frame when its content navigates away", async () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const expectedSrcdoc = injectIframeElementCSP("<p>hi</p>");

      const { container } = await render(
        <Excalidraw
          initialData={{
            elements: [
              createIframeElement({ status: "done", html: "<p>hi</p>" }),
            ],
          }}
        />,
      );

      // note: jsdom fires the initial `load` itself when the iframe is
      // inserted into the document (standing in for the srcdoc load)
      let iframe = await waitForIframe(container);
      expect(getIframe(container)).toBe(iframe);

      // navigations → remount back to srcdoc (up to the limit)
      for (let i = 0; i < 3; i++) {
        await load(iframe);
        const next = getIframe(container)!;
        expect(next).not.toBe(iframe);
        expect(next.getAttribute("srcdoc")).toBe(expectedSrcdoc);
        iframe = next;
      }
      expect(warn).not.toHaveBeenCalled();

      // exceeding the limit → blank frame
      await load(iframe);
      const blank = getIframe(container)!;
      expect(blank).not.toBe(iframe);
      expect(blank.getAttribute("srcdoc")).toBe("");
      expect(warn).toHaveBeenCalledTimes(1);

      // ...and stays blank
      await load(blank);
      expect(getIframe(container)).toBe(blank);
      expect(blank.getAttribute("srcdoc")).toBe("");

      warn.mockRestore();
    });

    it("doesn't treat srcdoc changes as navigation", async () => {
      const { container } = await render(
        <Excalidraw
          initialData={{
            elements: [
              createIframeElement({ status: "done", html: "<p>a</p>" }),
            ],
          }}
        />,
      );

      // (initial `load` fired by jsdom on insertion)
      const iframe = await waitForIframe(container);

      const [element] = window.h.elements;
      act(() => {
        window.h.app.scene.mutateElement(element, {
          customData: { generationData: { status: "done", html: "<p>b</p>" } },
        });
      });

      await waitFor(() => {
        expect(getIframe(container)!.getAttribute("srcdoc")).toBe(
          injectIframeElementCSP("<p>b</p>"),
        );
      });
      // load of the new srcdoc
      await load(getIframe(container)!);
      expect(getIframe(container)).toBe(iframe);
      expect(iframe.getAttribute("srcdoc")).toBe(
        injectIframeElementCSP("<p>b</p>"),
      );

      // ...whereas a subsequent load still is
      await load(iframe);
      expect(getIframe(container)).not.toBe(iframe);
      expect(getIframe(container)!.getAttribute("srcdoc")).toBe(
        injectIframeElementCSP("<p>b</p>"),
      );
    });

    it("doesn't give up on navigations that are far apart", async () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const now = vi.spyOn(Date, "now");
      let time = 1_000_000;
      now.mockImplementation(() => time);

      const { container } = await render(
        <Excalidraw
          initialData={{
            elements: [
              createIframeElement({ status: "done", html: "<p>hi</p>" }),
            ],
          }}
        />,
      );

      let iframe = await waitForIframe(container);
      for (let i = 0; i < 6; i++) {
        time += 10_000;
        await load(iframe);
        const next = getIframe(container)!;
        expect(next).not.toBe(iframe);
        expect(next.getAttribute("srcdoc")).toBe(
          injectIframeElementCSP("<p>hi</p>"),
        );
        iframe = next;
      }
      expect(warn).not.toHaveBeenCalled();

      now.mockRestore();
      warn.mockRestore();
    });
  });
});

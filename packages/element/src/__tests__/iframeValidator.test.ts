import { describe, it, expect } from "vitest";
import { iframeValidator } from "../embeddable";
import type { ExcalidrawIframeElement } from "../types";

const createIframeElement = (
  overrides: Partial<ExcalidrawIframeElement> = {},
): ExcalidrawIframeElement =>
  ({
    id: "test-iframe-1",
    type: "iframe",
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    angle: 0,
    strokeColor: "#000000",
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 2,
    strokeStyle: "solid",
    roughness: 0,
    opacity: 100,
    groupIds: [],
    frameId: null,
    roundness: null,
    seed: 12345,
    version: 1,
    versionNonce: 12345,
    index: null,
    isDeleted: false,
    boundElements: null,
    updated: Date.now(),
    link: null,
    locked: false,
    customData: undefined,
    ...overrides,
  }) as ExcalidrawIframeElement;

describe("iframeValidator", () => {
  describe("AI-generated content", () => {
    it("returns false for AI-generated content when no validateIframe prop (secure default)", () => {
      const element = createIframeElement({
        customData: {
          generationData: {
            status: "done",
            html: "<html><body>AI content</body></html>",
          },
        },
      });
      expect(iframeValidator(element, undefined)).toBe(false);
    });

    it("returns false for AI-generated content with validateIframe: false", () => {
      const element = createIframeElement({
        customData: {
          generationData: {
            status: "done",
            html: "<html><body>AI content</body></html>",
          },
        },
      });
      expect(iframeValidator(element, false)).toBe(false);
    });

    it("returns true for AI-generated content only when validateIframe: true", () => {
      const element = createIframeElement({
        customData: {
          generationData: {
            status: "done",
            html: "<html><body>AI content</body></html>",
          },
        },
      });
      expect(iframeValidator(element, true)).toBe(true);
    });

    it("returns false for AI-generated content with function that rejects", () => {
      const element = createIframeElement({
        customData: {
          generationData: {
            status: "done",
            html: "<html><body>AI content</body></html>",
          },
        },
      });
      expect(iframeValidator(element, () => false)).toBe(false);
    });

    it("returns true for AI-generated content with function that accepts", () => {
      const element = createIframeElement({
        customData: {
          generationData: {
            status: "done",
            html: "<html><body>AI content</body></html>",
          },
        },
      });
      expect(iframeValidator(element, () => true)).toBe(true);
    });

    it("returns true for AI content when in allowlist", () => {
      const element = createIframeElement({
        customData: {
          generationData: {
            status: "done",
            html: "<html><body>AI content</body></html>",
          },
        },
        src: "https://example.com/embed",
      } as any);
      expect(iframeValidator(element, ["example.com"])).toBe(true);
    });

    it("returns false for AI content not in allowlist", () => {
      const element = createIframeElement({
        customData: {
          generationData: {
            status: "done",
            html: "<html><body>AI content</body></html>",
          },
        },
        src: "https://evil.com/phish",
      } as any);
      expect(iframeValidator(element, ["example.com"])).toBe(false);
    });
  });

  describe("default behavior (no validateIframe prop)", () => {
    it("returns false when validateIframe is undefined", () => {
      const element = createIframeElement();
      expect(iframeValidator(element, undefined)).toBe(false);
    });

    it("returns false when validateIframe is null", () => {
      const element = createIframeElement();
      expect(iframeValidator(element, null)).toBe(false);
    });
  });

  describe("boolean validateIframe", () => {
    it("returns true when validateIframe is true", () => {
      const element = createIframeElement();
      expect(iframeValidator(element, true)).toBe(true);
    });

    it("returns false when validateIframe is false", () => {
      const element = createIframeElement();
      expect(iframeValidator(element, false)).toBe(false);
    });
  });

  describe("function validateIframe", () => {
    it("returns the function's return value", () => {
      const element = createIframeElement();
      expect(iframeValidator(element, () => true)).toBe(true);
      expect(iframeValidator(element, () => false)).toBe(false);
    });

    it("returns false if function returns non-boolean", () => {
      const element = createIframeElement();
      expect(
        iframeValidator(element, () => undefined as unknown as boolean),
      ).toBe(false);
    });
  });

  describe("RegExp validateIframe", () => {
    it("returns true when src matches the regex", () => {
      const element = createIframeElement({
        src: "https://example.com/embed",
      } as any);
      expect(iframeValidator(element, /example\.com/)).toBe(true);
    });

    it("returns false when src does not match the regex", () => {
      const element = createIframeElement({
        src: "https://evil.com/phish",
      } as any);
      expect(iframeValidator(element, /example\.com/)).toBe(false);
    });

    it("returns false when element has no src", () => {
      const element = createIframeElement();
      expect(iframeValidator(element, /example\.com/)).toBe(false);
    });
  });

  describe("Array validateIframe", () => {
    it("returns true when src matches a domain string", () => {
      const element = createIframeElement({
        src: "https://example.com/embed",
      } as any);
      expect(iframeValidator(element, ["example.com"])).toBe(true);
    });

    it("returns true when src matches a RegExp in array", () => {
      const element = createIframeElement({
        src: "https://example.com/embed",
      } as any);
      expect(iframeValidator(element, [/example\.com/])).toBe(true);
    });

    it("returns false when src matches nothing in array", () => {
      const element = createIframeElement({
        src: "https://evil.com/phish",
      } as any);
      expect(iframeValidator(element, ["example.com", /trusted\.com/])).toBe(
        false,
      );
    });

    it("returns false when element has no src", () => {
      const element = createIframeElement();
      expect(iframeValidator(element, ["example.com"])).toBe(false);
    });
  });

  describe("AI-generated content follows same rules as regular iframes", () => {
    it("returns false for AI content with empty allowlist", () => {
      const element = createIframeElement({
        customData: {
          generationData: {
            status: "done",
            html: "<html><body>AI content</body></html>",
          },
        },
      });
      expect(iframeValidator(element, [])).toBe(false);
    });

    it("returns false for AI content with function that rejects", () => {
      const element = createIframeElement({
        customData: {
          generationData: {
            status: "done",
            html: "<html><body>AI content</body></html>",
          },
        },
      });
      expect(iframeValidator(element, () => false)).toBe(false);
    });
  });
});

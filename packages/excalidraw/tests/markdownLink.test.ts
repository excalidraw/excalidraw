import { describe, expect, it } from "vitest";

import { parseMarkdownLink } from "../utils/markdownLink";

describe("parseMarkdownLink", () => {
  // ── Valid whole-text markdown links ───────────────────────────────────────

  it("parses a standard markdown link", () => {
    const result = parseMarkdownLink("[Excalidraw](https://excalidraw.com)");
    expect(result).toEqual({
      label: "Excalidraw",
      url: "https://excalidraw.com",
    });
  });

  it("parses a link with extra whitespace around the whole string", () => {
    const result = parseMarkdownLink(
      "  [Open docs](https://docs.example.com)  ",
    );
    expect(result).toEqual({
      label: "Open docs",
      url: "https://docs.example.com",
    });
  });

  it("uses the raw URL as label when label is empty", () => {
    const result = parseMarkdownLink("[](https://example.com)");
    expect(result).toEqual({
      label: "https://example.com",
      url: "https://example.com",
    });
  });

  it("parses a link with a relative URL", () => {
    const result = parseMarkdownLink("[Home](/home)");
    expect(result).not.toBeNull();
    expect(result!.label).toBe("Home");
    // normalizeLink keeps relative URLs as-is
    expect(result!.url).toBe("/home");
  });

  // ── Partial / multi-link text — must return null ──────────────────────────

  it("returns null for partial inline link (text before the link)", () => {
    expect(
      parseMarkdownLink("See [here](https://example.com) for details"),
    ).toBeNull();
  });

  it("returns null for plain text without any link syntax", () => {
    expect(parseMarkdownLink("Hello world")).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(parseMarkdownLink("")).toBeNull();
  });

  it("returns null for a bare URL with no label", () => {
    expect(parseMarkdownLink("https://example.com")).toBeNull();
  });

  it("returns null when the URL part is empty", () => {
    expect(parseMarkdownLink("[label]()")).toBeNull();
  });

  it("returns null for two markdown links in one string", () => {
    expect(
      parseMarkdownLink("[A](https://a.com)[B](https://b.com)"),
    ).toBeNull();
  });

  // ── Security — malicious / malformed URLs ─────────────────────────────────

  it("returns null for a javascript: URL (sanitize-url blocks it)", () => {
    // sanitize-url returns "about:blank" for javascript: URLs
    expect(parseMarkdownLink("[click me](javascript:alert(1))")).toBeNull();
  });

  it("returns null for a data: URL (sanitize-url blocks it)", () => {
    expect(parseMarkdownLink("[img](data:text/html,<h1>XSS</h1>)")).toBeNull();
  });
});

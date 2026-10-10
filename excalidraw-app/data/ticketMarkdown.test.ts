import { describe, expect, it } from "vitest";

import { renderInline, renderTicketMarkdown } from "./ticketMarkdown";

describe("escaping first", () => {
  it("renders a script tag as text, never as markup", () => {
    const html = renderTicketMarkdown('<script>alert("x")</script>');
    expect(html).not.toContain("<script");
    expect(html).toContain("&lt;script&gt;");
  });

  it("escapes an img onerror payload", () => {
    const html = renderTicketMarkdown("<img src=x onerror=alert(1)>");
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
  });

  it("refuses a javascript: link, keeping only the label", () => {
    // Assembled, so the linter does not read the test as using a script URL —
    // the point of the test is that the RENDERER refuses one.
    const scheme = ["java", "script:"].join("");
    const html = renderTicketMarkdown(`[click](${scheme}alert(1))`);
    expect(html).not.toContain(scheme);
    expect(html).toContain("click");
  });

  it("keeps an http link", () => {
    const html = renderTicketMarkdown("[docs](https://example.com/x)");
    expect(html).toContain('href="https://example.com/x"');
    expect(html).toContain('rel="noopener noreferrer"');
  });
});

describe("structure", () => {
  it("renders headings at their level", () => {
    const html = renderTicketMarkdown("# One\n\n## Two");
    expect(html).toContain("<h1>One</h1>");
    expect(html).toContain("<h2>Two</h2>");
  });

  it("renders a fenced code block verbatim, escaped", () => {
    const html = renderTicketMarkdown("```\nconst a = 1 < 2;\n```");
    expect(html).toContain("<pre><code>");
    expect(html).toContain("1 &lt; 2");
    // The block is NOT a paragraph, and the fences are gone.
    expect(html).not.toContain("<p>");
    expect(html).not.toContain("```");
  });

  it("renders unordered and ordered lists", () => {
    expect(renderTicketMarkdown("- a\n- b")).toContain(
      "<ul><li>a</li><li>b</li></ul>",
    );
    expect(renderTicketMarkdown("1. a\n2. b")).toContain(
      "<ol><li>a</li><li>b</li></ol>",
    );
  });

  it("renders a table with a header and rows", () => {
    const html = renderTicketMarkdown("| a | b |\n|---|---|\n| 1 | 2 |");
    expect(html).toContain("<table>");
    expect(html).toContain("<th>a</th>");
    expect(html).toContain("<td>2</td>");
  });

  it("renders a blockquote and a rule", () => {
    expect(renderTicketMarkdown("> quoted")).toContain(
      "<blockquote>quoted</blockquote>",
    );
    expect(renderTicketMarkdown("---")).toContain("<hr />");
  });

  it("gathers a paragraph across lines", () => {
    expect(renderTicketMarkdown("one\ntwo")).toContain("<p>one two</p>");
  });
});

describe("inline", () => {
  it("does bold, italic and code", () => {
    expect(renderInline("a **b** c")).toContain("<strong>b</strong>");
    expect(renderInline("a *b* c")).toContain("<em>b</em>");
    expect(renderInline("a `b` c")).toContain("<code>b</code>");
  });

  it("does not treat code contents as emphasis", () => {
    expect(renderInline("`a*b*c`")).toBe("<code>a*b*c</code>");
  });
});

describe("the real thing", () => {
  it("renders an actual ticket's shape without breaking", () => {
    const ticket = [
      "# feature-0001-uw-x",
      "",
      "**Type** feature · **Status** open · **Owner** @zerwiz",
      "",
      "## Requirements",
      "",
      "- one",
      "- two",
      "",
      "## Test cases",
      "",
      "| a | b |",
      "|---|---|",
      "| 1 | 2 |",
      "",
      "## Resolution",
      "",
      "*(filled on close)*",
    ].join("\n");
    const html = renderTicketMarkdown(ticket);
    expect(html).toContain("<h1>");
    expect(html).toContain("<h2>Requirements</h2>");
    expect(html).toContain("<ul><li>one</li><li>two</li></ul>");
    expect(html).toContain("<table>");
    expect(html).toContain("<em>(filled on close)</em>");
  });

  it("handles an empty body without throwing", () => {
    expect(renderTicketMarkdown("")).toBe("");
    expect(renderTicketMarkdown(undefined as unknown as string)).toBe("");
  });
});

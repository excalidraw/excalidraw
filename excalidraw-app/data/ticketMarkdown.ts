/**
 * Rendering a ticket's markdown.
 *
 * **Everything is escaped FIRST, then structure is added** — so a ticket file can
 * never inject markup into the board, whatever it contains. That matters because
 * the board can be served publicly and a ticket file is content, not code.
 *
 * Deliberately small: headings, lists, tables, code, blockquotes, rules, links
 * and emphasis — which is what a ticket is made of. No dependency, and no attempt
 * to be a markdown engine.
 *
 * `tickets/open/feature-0014-uw-render-and-edit-tickets-in-the-board.md`.
 */

// Placeholders for inline code while the rest of the line is transformed. A
// private-use character, so it cannot occur in a ticket and is not a control
// character a linter has to forgive.
const CODE_OPEN = "\uE000";
const CODE_CLOSE = "\uE001";

const escapeHTML = (text: string): string =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Only http(s) links survive; anything else is rendered as plain text. */
const safeURL = (url: string): string | null =>
  /^https?:\/\//i.test(url.trim()) ? url.trim() : null;

/**
 * Inline markup. Runs on ALREADY-ESCAPED text, so the only tags present are the
 * ones this function writes.
 */
export const renderInline = (escaped: string): string => {
  let out = escaped;

  // `code` first, so its contents are not then treated as emphasis or a link.
  const codes: string[] = [];
  out = out.replace(/`([^`]+)`/g, (_match, code: string) => {
    codes.push(`<code>${code}</code>`);
    return `${CODE_OPEN}${codes.length - 1}${CODE_CLOSE}`;
  });

  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/(^|[\s(])\*([^*\n]+)\*/g, "$1<em>$2</em>");

  out = out.replace(
    /\[([^\]]+)\]\(([^)\s]+)\)/g,
    (_match, label: string, url: string) => {
      const href = safeURL(url);
      return href
        ? `<a href="${href}" target="_blank" rel="noopener noreferrer">${label}</a>`
        : label;
    },
  );

  out = out.replace(
    new RegExp(`${CODE_OPEN}(\\d+)${CODE_CLOSE}`, "g"),
    (_match, index: string) => codes[Number(index)],
  );
  return out;
};

const splitRow = (line: string): string[] =>
  line
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((cell) => cell.trim());

const isTableSeparator = (line: string): boolean =>
  /^\|?[\s:|-]+\|?$/.test(line) && line.includes("-");

/**
 * The whole renderer. Line-based on purpose: a ticket's shape is lines, and a
 * line-based renderer cannot be fooled by nesting it does not support.
 */
export const renderTicketMarkdown = (markdown: string): string => {
  const lines = String(markdown ?? "").split("\n");
  const html: string[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    // ── fenced code ──
    if (/^```/.test(line)) {
      const body: string[] = [];
      index += 1;
      while (index < lines.length && !/^```/.test(lines[index])) {
        body.push(lines[index]);
        index += 1;
      }
      index += 1; // the closing fence
      html.push(`<pre><code>${escapeHTML(body.join("\n"))}</code></pre>`);
      continue;
    }

    // ── heading ──
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      html.push(
        `<h${level}>${renderInline(escapeHTML(heading[2]))}</h${level}>`,
      );
      index += 1;
      continue;
    }

    // ── horizontal rule ──
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      html.push("<hr />");
      index += 1;
      continue;
    }

    // ── table ──
    if (
      /^\s*\|/.test(line) &&
      index + 1 < lines.length &&
      isTableSeparator(lines[index + 1])
    ) {
      const header = splitRow(line);
      index += 2;
      const rows: string[][] = [];
      while (index < lines.length && /^\s*\|/.test(lines[index])) {
        rows.push(splitRow(lines[index]));
        index += 1;
      }
      html.push(
        `<table><thead><tr>${header
          .map((cell) => `<th>${renderInline(escapeHTML(cell))}</th>`)
          .join("")}</tr></thead><tbody>${rows
          .map(
            (row) =>
              `<tr>${row
                .map((cell) => `<td>${renderInline(escapeHTML(cell))}</td>`)
                .join("")}</tr>`,
          )
          .join("")}</tbody></table>`,
      );
      continue;
    }

    // ── blockquote ──
    if (/^\s*>\s?/.test(line)) {
      const body: string[] = [];
      while (index < lines.length && /^\s*>\s?/.test(lines[index])) {
        body.push(lines[index].replace(/^\s*>\s?/, ""));
        index += 1;
      }
      html.push(
        `<blockquote>${body
          .map((bit) => renderInline(escapeHTML(bit)))
          .join("<br />")}</blockquote>`,
      );
      continue;
    }

    // ── lists ──
    const unordered = /^\s*[-*]\s+/;
    const ordered = /^\s*\d+\.\s+/;
    if (unordered.test(line) || ordered.test(line)) {
      const isOrdered = ordered.test(line);
      const items: string[] = [];
      while (
        index < lines.length &&
        (isOrdered ? ordered : unordered).test(lines[index])
      ) {
        items.push(lines[index].replace(isOrdered ? ordered : unordered, ""));
        index += 1;
      }
      const tag = isOrdered ? "ol" : "ul";
      html.push(
        `<${tag}>${items
          .map((item) => `<li>${renderInline(escapeHTML(item))}</li>`)
          .join("")}</${tag}>`,
      );
      continue;
    }

    // ── blank ──
    if (line.trim() === "") {
      index += 1;
      continue;
    }

    // ── paragraph: gather until a blank line or a block starts ──
    const paragraph: string[] = [];
    while (
      index < lines.length &&
      lines[index].trim() !== "" &&
      !/^(#{1,6})\s+/.test(lines[index]) &&
      !/^```/.test(lines[index]) &&
      !/^\s*\|/.test(lines[index]) &&
      !/^\s*>\s?/.test(lines[index]) &&
      !unordered.test(lines[index]) &&
      !ordered.test(lines[index]) &&
      !/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(lines[index])
    ) {
      paragraph.push(lines[index]);
      index += 1;
    }
    html.push(`<p>${renderInline(escapeHTML(paragraph.join(" ")))}</p>`);
  }

  return html.join("\n");
};

import { expect, test, type Page } from "@playwright/test";

const installCanvasTextSpy = () => {
  const state = {
    nextId: 1,
    canvasIds: new WeakMap<HTMLCanvasElement, number>(),
    calls: [] as Array<
      | {
          kind: "fillText";
          canvasId: number;
          text: string;
          x: number;
          y: number;
          font: string;
          textAlign: CanvasTextAlign;
          textBaseline: CanvasTextBaseline;
          direction: CanvasDirection;
        }
      | {
          kind: "clear";
        }
    >,
  };

  const getCanvasId = (canvas: HTMLCanvasElement) => {
    let id = state.canvasIds.get(canvas);
    if (!id) {
      id = state.nextId++;
      state.canvasIds.set(canvas, id);
    }
    return id;
  };

  const origFillText = CanvasRenderingContext2D.prototype.fillText;
  CanvasRenderingContext2D.prototype.fillText = function (
    this: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    maxWidth?: number,
  ) {
    try {
      const canvas = this.canvas;
      if (canvas) {
        state.calls.push({
          kind: "fillText",
          canvasId: getCanvasId(canvas),
          text: String(text),
          x: Number(x),
          y: Number(y),
          font: String(this.font),
          textAlign: this.textAlign,
          textBaseline: this.textBaseline,
          direction: this.direction,
        });
      }
    } catch {}
    return (origFillText as any).call(this, text, x, y, maxWidth);
  };

  (window as any).__e2eCanvasText = {
    clear() {
      state.calls = [{ kind: "clear" }];
    },
    get() {
      return state.calls.slice();
    },
  };
};

const installOverlayRangeHelpers = () => {
  const getTextNodes = (root: Node) => {
    const out: Text[] = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      out.push(node as Text);
      node = walker.nextNode();
    }
    return out;
  };

  const getNodeOffsetAt = (
    root: HTMLElement,
    index: number,
    opts: { allowEnd: boolean },
  ) => {
    const textNodes = getTextNodes(root);
    let remaining = index;
    for (const n of textNodes) {
      const len = n.nodeValue?.length ?? 0;
      if (remaining < len) {
        return { node: n, offset: remaining };
      }
      if (remaining === len && opts.allowEnd) {
        return { node: n, offset: remaining };
      }
      remaining -= len;
    }
    const last = textNodes[textNodes.length - 1];
    return { node: last, offset: last?.nodeValue?.length ?? 0 };
  };

  const caretRectAt = (root: HTMLElement, index: number) => {
    const { node, offset } = getNodeOffsetAt(root, index, { allowEnd: true });
    const range = document.createRange();
    range.setStart(node, offset);
    range.setEnd(node, offset);
    const rect = range.getBoundingClientRect();
    return {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
    };
  };

  const charRectAt = (root: HTMLElement, index: number) => {
    const { node, offset } = getNodeOffsetAt(root, index, { allowEnd: false });
    const range = document.createRange();
    range.setStart(node, offset);
    range.setEnd(node, offset + 1);
    const rect = range.getBoundingClientRect();
    return {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
    };
  };

  const renderedLines = (root: HTMLElement, value: string) => {
    const normalized = value.replace(/\r\n?/g, "\n");
    const lines: string[] = [];
    let current = "";
    let currentTop: number | null = null;

    for (let i = 0; i < normalized.length; i++) {
      const ch = normalized[i];
      if (ch === "\n") {
        lines.push(current);
        current = "";
        currentTop = null;
        continue;
      }
      const rect = charRectAt(root, i);
      const top = Math.round(rect.y);
      if (currentTop === null) {
        currentTop = top;
        current += ch;
        continue;
      }
      if (top !== currentTop) {
        lines.push(current);
        current = ch;
        currentTop = top;
        continue;
      }
      current += ch;
    }
    lines.push(current);
    return lines;
  };

  const renderedCharRects = (root: HTMLElement, value: string) => {
    const normalized = value.replace(/\r\n?/g, "\n");
    const rects: Array<{
      x: number;
      y: number;
      width: number;
      height: number;
    }> = [];
    for (let i = 0; i < normalized.length; i++) {
      const ch = normalized[i];
      if (ch === "\n") {
        continue;
      }
      rects.push(charRectAt(root, i));
    }
    return rects;
  };

  const renderedCaretXs = (root: HTMLElement, value: string) => {
    const normalized = value.replace(/\r\n?/g, "\n");
    const xs: number[] = [];
    for (let i = 0; i < normalized.length; i++) {
      const ch = normalized[i];
      if (ch === "\n") {
        continue;
      }
      xs.push(caretRectAt(root, i).x);
    }
    return xs;
  };

  (window as any).__e2eOverlay = {
    caretRectAt,
    charRectAt,
    renderedLines,
    renderedCharRects,
    renderedCaretXs,
  };
};

const normalizeNewlines = (s: string) => s.replace(/\r\n?/g, "\n");

const generateRandomText = (seed: number, minLength: number) => {
  let state = seed >>> 0;
  const next = () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state;
  };
  const rand = (n: number) => next() % n;

  const chinese =
    "选中画布某个元素后在右键菜单添加扶正选项点击后元素没有旋转角度";
  const ascii =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const symbols = " ~!@#$%^&*()_+-=[]{};:'\",.<>/?\\|";

  let out = "";
  let newlineCount = 0;
  let spaceCount = 0;

  while (out.length < minLength) {
    const r = rand(100);
    if (r < 8 && out.length > 0 && out[out.length - 1] !== "\n") {
      out += "\n";
      newlineCount++;
      continue;
    }
    if (r < 18) {
      out += " ";
      spaceCount++;
      if (rand(3) === 0) {
        out += " ";
        spaceCount++;
      }
      continue;
    }
    if (r < 55) {
      out += ascii[rand(ascii.length)];
      continue;
    }
    if (r < 75) {
      out += symbols[rand(symbols.length)];
      continue;
    }
    out += chinese[rand(chinese.length)];
  }

  if (newlineCount === 0) {
    out = `${out.slice(0, 60)}\n${out.slice(60)}`;
  }
  if (spaceCount < 5) {
    out = `${out}     `;
  }

  return normalizeNewlines(out);
};

const getCanvasLinesFromCalls = (
  calls: Array<any>,
  opts: { minLines: number },
) => {
  const grouped = new Map<number, Array<{ text: string; y: number }>>();
  for (const c of calls) {
    if (c?.kind !== "fillText") {
      continue;
    }
    const text = String(c.text);
    if (!text || text === "↵") {
      continue;
    }
    if (/^\d+$/.test(text)) {
      continue;
    }
    const canvasId = Number(c.canvasId);
    const arr = grouped.get(canvasId) || [];
    arr.push({ text, y: Number(c.y) });
    grouped.set(canvasId, arr);
  }

  let best: Array<{ text: string; y: number }> = [];
  for (const arr of grouped.values()) {
    if (arr.length > best.length) {
      best = arr;
    }
  }

  const lines = best
    .slice()
    .sort((a, b) => a.y - b.y)
    .map((x) => x.text);

  if (lines.length < opts.minLines) {
    throw new Error(`insufficient canvas lines: ${lines.length}`);
  }

  return lines;
};

const selectTool = async (page: Page, tool: string) => {
  await page.locator(`[data-testid="toolbar-${tool}"]`).locator("..").click();
};

const openTextEditorAt = async (page: Page, x: number, y: number) => {
  await selectTool(page, "text");
  const canvas = page.locator("canvas.interactive");
  await canvas.waitFor();
  await canvas.click({ position: { x, y } });
  const editor = page.locator("textarea.excalidraw-wysiwyg");
  await expect(editor).toBeVisible();
  return editor;
};

const exitEditor = async (page: Page) => {
  const editor = page.locator("textarea.excalidraw-wysiwyg");
  await editor.press("Escape");
  await expect(editor).toHaveCount(0);
};

const openEditorByDoubleClickAt = async (page: Page, x: number, y: number) => {
  await selectTool(page, "selection");
  const canvas = page.locator("canvas.interactive");
  await canvas.dblclick({ position: { x, y } });
  const editor = page.locator("textarea.excalidraw-wysiwyg");
  await expect(editor).toBeVisible();
  return editor;
};

const getEditorBox = async (page: Page) => {
  const editor = page.locator("textarea.excalidraw-wysiwyg");
  const box = await editor.boundingBox();
  if (!box) {
    throw new Error("missing editor bounding box");
  }
  return box;
};

const dragResizeFromRight = async (
  page: Page,
  editorBox: { x: number; y: number; width: number; height: number },
  deltaX: number,
) => {
  await selectTool(page, "selection");
  const canvas = page.locator("canvas.interactive");
  await page.mouse.click(
    editorBox.x + editorBox.width / 2,
    editorBox.y + editorBox.height / 2,
  );
  const start = {
    x: editorBox.x + editorBox.width - 1,
    y: editorBox.y + editorBox.height / 2,
  };
  const end = { x: start.x + deltaX, y: start.y };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y);
  await page.mouse.up();
  await canvas.waitFor();
};

const toggleTheme = async (page: Page) => {
  await page.keyboard.press("Shift+Alt+D");
};

const waitForCanvasTextCalls = async (page: Page) => {
  await page.waitForFunction(() => {
    const calls = (window as any).__e2eCanvasText?.get?.() || [];
    return calls.some((c: any) => c?.kind === "fillText");
  });
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(installCanvasTextSpy);
  await page.addInitScript(installOverlayRangeHelpers);
});

test("clicking to edit the text box will not change the character absolute position (E2E)", async ({
  page,
}) => {
  await page.goto("/");

  const value = generateRandomText(1337, 220);

  const createX = 240;
  const createY = 180;

  const editor = await openTextEditorAt(page, createX, createY);
  await editor.fill(value);

  const overlay = page.locator(".excalidraw-wysiwyg__whitespaceOverlay");
  await expect(overlay).toBeVisible();
  await exitEditor(page);

  const editorForBox = await openEditorByDoubleClickAt(page, createX, createY);
  await editorForBox.waitFor();
  const baseBox = await getEditorBox(page);
  await exitEditor(page);

  await dragResizeFromRight(page, baseBox, -120);

  await openEditorByDoubleClickAt(page, createX, createY);
  await expect(
    page.locator(".excalidraw-wysiwyg__whitespaceOverlay"),
  ).toBeVisible();

  const initialCharRects = await page.evaluate(
    ({ value }) => {
      const overlay = document.querySelector<HTMLElement>(
        ".excalidraw-wysiwyg__whitespaceOverlay",
      );
      if (!overlay) {
        throw new Error("missing overlay");
      }
      return (window as any).__e2eOverlay.renderedCharRects(overlay, value);
    },
    { value },
  );

  await page.evaluate(() => (window as any).__e2eCanvasText.clear());
  await exitEditor(page);
  await toggleTheme(page);
  await waitForCanvasTextCalls(page);

  const calls = await page.evaluate(() =>
    (window as any).__e2eCanvasText.get(),
  );
  const canvasLines = getCanvasLinesFromCalls(calls, { minLines: 1 });
  await toggleTheme(page);

  await openEditorByDoubleClickAt(page, createX, createY);
  await expect(
    page.locator(".excalidraw-wysiwyg__whitespaceOverlay"),
  ).toBeVisible();

  const domLines = await page.evaluate(
    ({ value }) => {
      const overlay = document.querySelector<HTMLElement>(
        ".excalidraw-wysiwyg__whitespaceOverlay",
      );
      if (!overlay) {
        throw new Error("missing overlay");
      }
      return (window as any).__e2eOverlay.renderedLines(overlay, value);
    },
    { value },
  );

  expect(domLines).toEqual(canvasLines);

  const afterCharRects = await page.evaluate(
    ({ value }) => {
      const overlay = document.querySelector<HTMLElement>(
        ".excalidraw-wysiwyg__whitespaceOverlay",
      );
      if (!overlay) {
        throw new Error("missing overlay");
      }
      return (window as any).__e2eOverlay.renderedCharRects(overlay, value);
    },
    { value },
  );

  expect(afterCharRects.length).toBe(initialCharRects.length);
  for (let i = 0; i < afterCharRects.length; i++) {
    const a = afterCharRects[i]!;
    const b = initialCharRects[i]!;
    expect(Math.abs(a.x - b.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(a.y - b.y)).toBeLessThanOrEqual(1);
  }

  await exitEditor(page);
});

test("resizing text narrower and repeating operation A should keep wrapping consistent (E2E)", async ({
  page,
}) => {
  await page.goto("/");

  const value = generateRandomText(20250315, 240);

  const createX = 240;
  const createY = 180;

  const editor = await openTextEditorAt(page, createX, createY);
  await editor.fill(value);
  await exitEditor(page);

  const editorForBox = await openEditorByDoubleClickAt(page, createX, createY);
  await editorForBox.waitFor();
  const baseBox = await getEditorBox(page);
  await exitEditor(page);

  let currentBox = baseBox;
  for (let i = 0; i < 20; i++) {
    await dragResizeFromRight(page, currentBox, -5);
    await page.evaluate(() => (window as any).__e2eCanvasText.clear());
    await toggleTheme(page);
    await waitForCanvasTextCalls(page);
    const calls = await page.evaluate(() =>
      (window as any).__e2eCanvasText.get(),
    );
    const canvasLines = getCanvasLinesFromCalls(calls, { minLines: 1 });

    await toggleTheme(page);
    const editorAfterResize = await openEditorByDoubleClickAt(
      page,
      createX,
      createY,
    );
    await editorAfterResize.waitFor();

    const domLines = await page.evaluate(
      ({ value }) => {
        const overlay = document.querySelector<HTMLElement>(
          ".excalidraw-wysiwyg__whitespaceOverlay",
        );
        if (!overlay) {
          throw new Error("missing overlay");
        }
        return (window as any).__e2eOverlay.renderedLines(overlay, value);
      },
      { value },
    );

    expect(domLines).toEqual(canvasLines);

    currentBox = await getEditorBox(page);
    await exitEditor(page);
  }
});

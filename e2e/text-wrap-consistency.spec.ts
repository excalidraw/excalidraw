import { expect, test, type Page } from "@playwright/test";

const installCanvasTextSpy = () => {
  const state = {
    nextId: 1,
    canvasIds: new WeakMap<object, number>(),
    bitmapToSourceCanvasId: new WeakMap<object, number>(),
    calls: [] as Array<
      | {
          kind: "fillText";
          canvasId: number;
          canvasWidth: number;
          canvasHeight: number;
          canvasIsInteractive: boolean;
          canvasIsStatic: boolean;
          text: string;
          x: number;
          y: number;
          font: string;
          textAlign: CanvasTextAlign;
          textBaseline: CanvasTextBaseline;
          direction: CanvasDirection;
          transform: [number, number, number, number, number, number];
        }
      | {
          kind: "drawImage";
          sourceCanvasId: number;
          sourceWidth: number;
          sourceHeight: number;
          targetCanvasId: number;
          targetWidth: number;
          targetHeight: number;
          targetIsInteractive: boolean;
          targetIsStatic: boolean;
          args: number[];
          transform: [number, number, number, number, number, number];
        }
      | {
          kind: "clear";
        }
    >,
  };

  const getCanvasId = (canvas: any) => {
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
      const canvas = (this as any).canvas;
      if (canvas) {
        const t = this.getTransform();
        state.calls.push({
          kind: "fillText",
          canvasId: getCanvasId(canvas),
          canvasWidth: canvas.width,
          canvasHeight: canvas.height,
          canvasIsInteractive:
            canvas instanceof HTMLCanvasElement &&
            canvas.classList.contains("interactive"),
          canvasIsStatic:
            canvas instanceof HTMLCanvasElement &&
            canvas.classList.contains("static"),
          text: String(text),
          x: Number(x),
          y: Number(y),
          font: String(this.font),
          textAlign: this.textAlign,
          textBaseline: this.textBaseline,
          direction: this.direction,
          transform: [t.a, t.b, t.c, t.d, t.e, t.f],
        });
      }
    } catch {}
    return (origFillText as any).call(this, text, x, y, maxWidth);
  };

  const origDrawImage = CanvasRenderingContext2D.prototype.drawImage;
  CanvasRenderingContext2D.prototype.drawImage = function (
    this: CanvasRenderingContext2D,
    image: CanvasImageSource,
    ...rest: any[]
  ) {
    try {
      const sourceCanvas =
        image instanceof HTMLCanvasElement ||
        (typeof OffscreenCanvas !== "undefined" &&
          image instanceof OffscreenCanvas)
          ? image
          : null;

      const sourceBitmap =
        typeof ImageBitmap !== "undefined" && image instanceof ImageBitmap
          ? image
          : null;

      const targetCanvas = this.canvas;
      if ((sourceCanvas || sourceBitmap) && targetCanvas) {
        const sourceCanvasId = sourceCanvas
          ? getCanvasId(sourceCanvas)
          : state.bitmapToSourceCanvasId.get(sourceBitmap!) ?? -1;
        const targetCanvasId = getCanvasId(targetCanvas);
        const t = this.getTransform();
        const args: number[] = rest
          .map((v) => Number(v))
          .filter(Number.isFinite);
        if (sourceCanvasId === -1) {
          return (origDrawImage as any).call(this, image, ...rest);
        }
        state.calls.push({
          kind: "drawImage",
          sourceCanvasId,
          sourceWidth: sourceCanvas ? sourceCanvas.width : sourceBitmap!.width,
          sourceHeight: sourceCanvas
            ? sourceCanvas.height
            : sourceBitmap!.height,
          targetCanvasId,
          targetWidth: targetCanvas.width,
          targetHeight: targetCanvas.height,
          targetIsInteractive:
            targetCanvas instanceof HTMLCanvasElement &&
            targetCanvas.classList.contains("interactive"),
          targetIsStatic:
            targetCanvas instanceof HTMLCanvasElement &&
            targetCanvas.classList.contains("static"),
          args,
          transform: [t.a, t.b, t.c, t.d, t.e, t.f],
        });
      }
    } catch {}
    return (origDrawImage as any).call(this, image, ...rest);
  };

  const patchTransferToImageBitmap = (proto: any) => {
    const orig = proto?.transferToImageBitmap;
    if (typeof orig !== "function") {
      return;
    }
    proto.transferToImageBitmap = function (this: any, ...args: any[]) {
      const bitmap = orig.apply(this, args);
      try {
        state.bitmapToSourceCanvasId.set(bitmap, getCanvasId(this));
      } catch {}
      return bitmap;
    };
  };

  patchTransferToImageBitmap(HTMLCanvasElement.prototype);
  if (typeof OffscreenCanvas !== "undefined") {
    patchTransferToImageBitmap((OffscreenCanvas as any).prototype);
  }

  if (typeof createImageBitmap === "function") {
    const origCreate = createImageBitmap;
    // @ts-expect-error override global for E2E
    window.createImageBitmap = function (image: any, ...args: any[]) {
      const sourceId =
        image instanceof HTMLCanvasElement ||
        (typeof OffscreenCanvas !== "undefined" &&
          image instanceof OffscreenCanvas)
          ? getCanvasId(image)
          : null;
      const p = (origCreate as any).call(window, image, ...args);
      if (sourceId == null) {
        return p;
      }
      return p.then((bitmap: any) => {
        try {
          state.bitmapToSourceCanvasId.set(bitmap, sourceId);
        } catch {}
        return bitmap;
      });
    };
  }

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

const getStaticCanvasRegionHashForTextElement = async (
  page: Page,
  elementId: string,
) => {
  return page.evaluate(
    ({ elementId }) => {
      const h = (window as any).h;
      if (!h?.state) {
        throw new Error("missing app state");
      }
      const state = h.state;
      const zoom = Number(state.zoom?.value) || 1;

      const el = (h.elements || []).find((e: any) => e?.id === elementId);
      if (!el || el.type !== "text") {
        throw new Error("missing text element");
      }

      const canvas = document.querySelector<HTMLCanvasElement>(
        "canvas.excalidraw__canvas.static",
      );
      if (!canvas) {
        throw new Error("missing static canvas");
      }
      const rect = canvas.getBoundingClientRect();
      const scaleX = rect.width ? canvas.width / rect.width : 1;
      const scaleY = rect.height ? canvas.height / rect.height : 1;

      const paddingClientPx = 4;
      const leftClient =
        (el.x + state.scrollX) * zoom + rect.left - paddingClientPx;
      const topClient =
        (el.y + state.scrollY) * zoom + rect.top - paddingClientPx;
      const widthClient = el.width * zoom + paddingClientPx * 2;
      const heightClient = el.height * zoom + paddingClientPx * 2;

      const sx = Math.max(0, Math.floor((leftClient - rect.left) * scaleX));
      const sy = Math.max(0, Math.floor((topClient - rect.top) * scaleY));
      const ex = Math.min(
        canvas.width,
        Math.ceil((leftClient - rect.left + widthClient) * scaleX),
      );
      const ey = Math.min(
        canvas.height,
        Math.ceil((topClient - rect.top + heightClient) * scaleY),
      );

      const sw = Math.max(0, ex - sx);
      const sh = Math.max(0, ey - sy);
      if (sw === 0 || sh === 0) {
        throw new Error("empty canvas region");
      }

      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) {
        throw new Error("missing 2d context");
      }
      const data = ctx.getImageData(sx, sy, sw, sh).data;

      let hash = 14695981039346656037n;
      const prime = 1099511628211n;
      for (let i = 0; i < data.length; i++) {
        hash ^= BigInt(data[i]);
        hash = (hash * prime) & 18446744073709551615n;
      }

      return `${sw}x${sh}:${hash.toString(16)}`;
    },
    { elementId },
  );
};

// removed: hashBytes64 (no longer used)

// removed: getViewportRegionHashForTextElement (use static-canvas hashing instead)

type GridPosition = {
  cellX: number;
  cellY: number;
  offsetX: number;
  offsetY: number;
};

const getGridPositionsFromOverlay = async (page: Page, value: string) => {
  return page.evaluate(
    ({ value }) => {
      const overlay = document.querySelector<HTMLElement>(
        ".excalidraw-wysiwyg__whitespaceOverlay",
      );
      if (!overlay) {
        throw new Error("missing overlay");
      }
      const normalized = String(value).replace(/\r\n?/g, "\n");
      const rects: Array<{
        x: number;
        y: number;
        width: number;
        height: number;
      }> = [];
      for (let i = 0; i < normalized.length; i++) {
        if (normalized[i] === "\n") {
          continue;
        }
        rects.push((window as any).__e2eOverlay.caretRectAt(overlay, i));
      }
      const state = (window as any).h?.state;
      if (!state) {
        throw new Error("missing app state");
      }
      const staticCanvas = document.querySelector<HTMLCanvasElement>(
        "canvas.excalidraw__canvas.static",
      );
      if (!staticCanvas) {
        throw new Error("missing static canvas");
      }
      const canvasRect = staticCanvas.getBoundingClientRect();
      const zoom = Number(state.zoom?.value) || 1;
      const gridSize = Number(state.gridSize) || 1;
      const out: GridPosition[] = [];
      for (const r of rects) {
        const clientX = r.x;
        const clientY = r.y + r.height / 2;
        const sceneX = (clientX - canvasRect.left) / zoom - state.scrollX;
        const sceneY = (clientY - canvasRect.top) / zoom - state.scrollY;
        const cellX = Math.floor(sceneX / gridSize);
        const cellY = Math.floor(sceneY / gridSize);
        const offsetX = sceneX - cellX * gridSize;
        const offsetY = sceneY - cellY * gridSize;
        out.push({
          cellX,
          cellY,
          offsetX: Math.round(offsetX * 100) / 100,
          offsetY: Math.round(offsetY * 100) / 100,
        });
      }
      return out;
    },
    { value },
  );
};

const getCanvasLinesFromRender = async (page: Page, value: string) => {
  return page.evaluate(
    ({ value }) => {
      const calls = (window as any).__e2eCanvasText?.get?.() || [];

      const grouped = new Map<number, any[]>();
      for (const c of calls) {
        if (c?.kind !== "fillText") {
          continue;
        }
        const text = String(c.text);
        if (!text || text === "↵" || /^\d+$/.test(text)) {
          continue;
        }
        const canvasId = Number(c.canvasId);
        const arr = grouped.get(canvasId) || [];
        arr.push(c);
        grouped.set(canvasId, arr);
      }

      const normalized = String(value).replace(/\r\n?/g, "\n");
      const expectedLen = normalized.replace(/\n/g, "").length;

      let best: any[] = [];
      let bestScore = Number.POSITIVE_INFINITY;
      let bestLen = -1;

      for (const arr of grouped.values()) {
        const totalLen = arr.reduce((acc, c) => acc + String(c.text).length, 0);
        const score = Math.abs(totalLen - expectedLen);
        if (score < bestScore || (score === bestScore && totalLen > bestLen)) {
          bestScore = score;
          bestLen = totalLen;
          best = arr;
        }
      }

      if (best.length === 0) {
        throw new Error("missing canvas text lines");
      }

      return best
        .slice()
        .sort((a, b) => Number(a.y) - Number(b.y))
        .map((c) => String(c.text));
    },
    { value },
  );
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(installCanvasTextSpy);
  await page.addInitScript(installOverlayRangeHelpers);
});

test("clicking to edit the text box will not change the character absolute position (E2E)", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() => {
    (window as any).h?.setState?.({
      gridModeEnabled: true,
      gridSize: 20,
      gridStep: 5,
      currentItemFontFamily: 12,
    });
  });

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
  const editGridPositionsBefore = await getGridPositionsFromOverlay(
    page,
    value,
  );
  await exitEditor(page);

  await page.evaluate(() => (window as any).__e2eCanvasText.clear());
  await toggleTheme(page);
  await waitForCanvasTextCalls(page);
  await toggleTheme(page);

  const canvasLines = await getCanvasLinesFromRender(page, value);

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

  const editGridPositionsAfter = await getGridPositionsFromOverlay(page, value);
  expect(editGridPositionsAfter).toEqual(editGridPositionsBefore);

  await exitEditor(page);
});

//“第一次必定落到下一行”，第二次点击又正常测试
test("first click to edit selected multi-line text should not jump to next line (E2E)", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() => {
    (window as any).h?.setState?.({
      currentItemFontFamily: 12,
      currentItemFontSize: 32,
    });
  });

  const value = "Hello\nWorld";
  const createX = 240;
  const createY = 180;

  const editor = await openTextEditorAt(page, createX, createY);
  await editor.fill(value);
  await exitEditor(page);

  const editorForProbe = await openEditorByDoubleClickAt(
    page,
    createX,
    createY,
  );
  await editorForProbe.waitFor();
  await expect(
    page.locator(".excalidraw-wysiwyg__whitespaceOverlay"),
  ).toBeVisible();
  const clickPoint = await page.evaluate(() => {
    const overlay = document.querySelector<HTMLElement>(
      ".excalidraw-wysiwyg__whitespaceOverlay",
    );
    if (!overlay) {
      throw new Error("missing overlay");
    }
    const r = (window as any).__e2eOverlay.charRectAt(overlay, 1);
    return {
      clientX: r.x + Math.max(1, r.width / 2),
      clientY: r.y + r.height / 2,
    };
  });
  await exitEditor(page);

  await selectTool(page, "selection");
  const canvas = page.locator("canvas.interactive");
  await canvas.waitFor();
  const canvasBox = await canvas.boundingBox();
  if (!canvasBox) {
    throw new Error("missing canvas bounding box");
  }
  const pos = {
    x: clickPoint.clientX - canvasBox.x,
    y: clickPoint.clientY - canvasBox.y,
  };

  await canvas.click({ position: pos });
  await canvas.click({ position: pos });

  const editor2 = page.locator("textarea.excalidraw-wysiwyg");
  await expect(editor2).toBeVisible();
  await page.waitForFunction(() => {
    const d = (window as any).__e2eWysiwygPointerDebug;
    return (
      d &&
      d.method === "scene" &&
      Number.isFinite(d.clampedLineIndex) &&
      Number.isFinite(d.resolvedIndex)
    );
  });

  const res = await page.evaluate(() => {
    const textarea = document.querySelector<HTMLTextAreaElement>(
      "textarea.excalidraw-wysiwyg",
    );
    if (!textarea) {
      throw new Error("missing textarea");
    }
    const value = textarea.value;
    const newlineIndex = value.indexOf("\n");
    return {
      selectionStart: textarea.selectionStart,
      selectionEnd: textarea.selectionEnd,
      newlineIndex,
      debug: (window as any).__e2eWysiwygPointerDebug,
    };
  });

  expect(res.selectionStart).toBe(res.selectionEnd);
  expect(res.newlineIndex).toBeGreaterThan(-1);
  expect(res.selectionStart).toBeLessThanOrEqual(res.newlineIndex);
  expect(res.debug.method).toBe("scene");
  expect(res.debug.clampedLineIndex).toBe(0);
  expect(res.debug.resolvedIndex).toBeLessThanOrEqual(res.newlineIndex);
});

test("resizing text narrower and repeating operation A should keep wrapping consistent (E2E)", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() => {
    (window as any).h?.setState?.({
      gridModeEnabled: true,
      gridSize: 20,
      gridStep: 5,
      currentItemFontFamily: 12,
    });
  });

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
    await toggleTheme(page);

    const canvasLines = await getCanvasLinesFromRender(page, value);

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

    const editGrid1 = await getGridPositionsFromOverlay(page, value);
    await exitEditor(page);

    await openEditorByDoubleClickAt(page, createX, createY);
    await expect(
      page.locator(".excalidraw-wysiwyg__whitespaceOverlay"),
    ).toBeVisible();
    const editGrid2 = await getGridPositionsFromOverlay(page, value);
    expect(editGrid2).toEqual(editGrid1);

    currentBox = await getEditorBox(page);
    await exitEditor(page);
  }
});

//进入编辑态（出现 textarea.excalidraw-wysiwyg）不会改变“空白符标记”的渲染结果 。
//改用 getStaticCanvasRegionHashForTextElement() 那种“直接从 static canvas 取 imageData”的 hash（不会把 DOM caret/textarea 算进去）
//failed2026.3.16-16.23.06
test("editing should not change whitespace marker rendering (E2E)", async ({
  page,
}) => {
  await page.goto("/");
  await page.addStyleTag({
    content:
      "canvas.excalidraw__canvas.interactive{opacity:0 !important;} .excalidraw__canvas.interactive{opacity:0 !important;}",
  });
  await page.evaluate(() => {
    (window as any).h?.setState?.({
      gridModeEnabled: true,
      gridSize: 20,
      gridStep: 5,
      currentItemFontFamily: 12,
      currentItemFontSize: 20,
    });
  });

  const value = "A  B\nC   D\nE";

  const createX = 240;
  const createY = 180;

  const editor = await openTextEditorAt(page, createX, createY);
  await editor.fill(value);
  await exitEditor(page);

  const textElementId = await page.evaluate(() => {
    const h = (window as any).h;
    const els = h?.elements || [];
    const text = [...els].reverse().find((e: any) => e?.type === "text");
    if (!text) {
      throw new Error("missing text element");
    }
    return String(text.id);
  });

  await page.mouse.click(10, 10);
  const before = await getStaticCanvasRegionHashForTextElement(
    page,
    textElementId,
  );

  await openEditorByDoubleClickAt(page, createX, createY);
  await page.evaluate(() => {
    const textarea = document.querySelector<HTMLTextAreaElement>(
      "textarea.excalidraw-wysiwyg",
    );
    if (!textarea) {
      throw new Error("missing textarea");
    }
    textarea.selectionStart = textarea.selectionEnd = textarea.value.length;
    textarea.style.caretColor = "transparent";
  });

  const during = await getStaticCanvasRegionHashForTextElement(
    page,
    textElementId,
  );
  expect(during).toEqual(before);

  await exitEditor(page);
});

test("getImageData clicking to edit the text box will not change the character absolute position (E2E, zoom=3000%)", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() => {
    (window as any).h?.setState?.({
      gridModeEnabled: true,
      gridSize: 20,
      gridStep: 5,
      currentItemFontFamily: 12,
      currentItemFontSize: 1,
      zoom: { value: 30 },
    });
  });

  const value = generateRandomText(424242, 220);

  const createX = 240;
  const createY = 180;

  const editor = await openTextEditorAt(page, createX, createY);
  await editor.fill(value);
  await exitEditor(page);

  const textElementId = await page.evaluate(() => {
    const h = (window as any).h;
    const els = h?.elements || [];
    const text = [...els].reverse().find((e: any) => e?.type === "text");
    if (!text) {
      throw new Error("missing text element");
    }
    return String(text.id);
  });

  const captureA = async () => {
    await page.evaluate(() => (window as any).__e2eCanvasText.clear());
    await toggleTheme(page);
    await waitForCanvasTextCalls(page);
    await toggleTheme(page);
    const before = await getStaticCanvasRegionHashForTextElement(
      page,
      textElementId,
    );

    await openEditorByDoubleClickAt(page, createX, createY);
    await page.evaluate(() => (window as any).__e2eCanvasText.clear());
    await toggleTheme(page);
    await waitForCanvasTextCalls(page);
    await toggleTheme(page);
    const during = await getStaticCanvasRegionHashForTextElement(
      page,
      textElementId,
    );

    expect(during).toEqual(before);
    await exitEditor(page);
  };

  await captureA();

  for (let i = 0; i < 6; i++) {
    const editorForBox = await openEditorByDoubleClickAt(
      page,
      createX,
      createY,
    );
    await editorForBox.waitFor();
    const box = await getEditorBox(page);
    await exitEditor(page);

    await dragResizeFromRight(page, box, -5 * 30);
    await captureA();
  }
});

const percentile = (values: number[], p: number) => {
  if (!values.length) {
    return NaN;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const clampedP = Math.min(1, Math.max(0, p));
  const idx = Math.ceil(clampedP * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, idx))];
};

// response speed
test("response speed: long text editing (E2E)", async ({ page }) => {
  test.setTimeout(900_000);
  await page.goto("/");

  const createX = 240;
  const createY = 180;
  const targetWidth = 300;

  await openTextEditorAt(page, createX, createY);
  const base = generateRandomText(424242, 50_000);
  await page.evaluate((value) => {
    const textarea = document.querySelector<HTMLTextAreaElement>(
      "textarea.excalidraw-wysiwyg",
    );
    if (!textarea) {
      throw new Error("missing textarea");
    }
    textarea.value = String(value);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  }, base);
  await page.waitForFunction((len) => {
    const textarea = document.querySelector<HTMLTextAreaElement>(
      "textarea.excalidraw-wysiwyg",
    );
    return textarea?.value.length === Number(len);
  }, base.length);

  await exitEditor(page);

  const editorForBox = await openEditorByDoubleClickAt(page, createX, createY);
  await editorForBox.waitFor();
  const baseBox = await getEditorBox(page);
  await exitEditor(page);

  await dragResizeFromRight(page, baseBox, targetWidth - baseBox.width);

  const editor = await openEditorByDoubleClickAt(page, createX, createY);
  await editor.waitFor();
  const latencies: number[] = [];
  for (let i = 0; i < 5; i++) {
    const dt = await page.evaluate(() => {
      const textarea = document.querySelector<HTMLTextAreaElement>(
        "textarea.excalidraw-wysiwyg",
      );
      if (!textarea) {
        throw new Error("missing textarea");
      }
      textarea.selectionStart = textarea.selectionEnd = textarea.value.length;
      const t0 = performance.now();
      textarea.dispatchEvent(
        new KeyboardEvent("keydown", { key: "x", bubbles: true }),
      );
      textarea.value += "x";
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
      return performance.now() - t0;
    });
    latencies.push(dt);
  }

  const p95 = percentile(latencies, 0.95);
  const p50 = percentile(latencies, 0.5);
  const max = Math.max(...latencies);
  process.stdout.write(
    `[response speed] long text editing: p50=${p50.toFixed(
      1,
    )}ms p95=${p95.toFixed(1)}ms max=${max.toFixed(1)}ms n=${
      latencies.length
    }\n`,
  );
  expect(p95).toBeLessThan(500);
  expect(max).toBeLessThan(1000);

  await exitEditor(page);
});

// response speed
test("response speed: Alt+ArrowUp/Down move line (E2E)", async ({ page }) => {
  test.setTimeout(900_000);
  await page.goto("/");

  const createX = 240;
  const createY = 180;
  const targetWidth = 300;

  await openTextEditorAt(page, createX, createY);
  const raw = generateRandomText(424242, 50_000);
  let value = "";
  for (let i = 0; i < raw.length; i += 80) {
    value += raw.slice(i, i + 80);
    if (i + 80 < raw.length) {
      value += "\n";
    }
  }
  value = value.slice(0, 50_000);

  await page.evaluate((text) => {
    const textarea = document.querySelector<HTMLTextAreaElement>(
      "textarea.excalidraw-wysiwyg",
    );
    if (!textarea) {
      throw new Error("missing textarea");
    }
    textarea.value = String(text);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  }, value);
  await page.waitForFunction((len) => {
    const textarea = document.querySelector<HTMLTextAreaElement>(
      "textarea.excalidraw-wysiwyg",
    );
    return textarea?.value.length === Number(len);
  }, value.length);

  await exitEditor(page);

  const editorForBox = await openEditorByDoubleClickAt(page, createX, createY);
  await editorForBox.waitFor();
  const baseBox = await getEditorBox(page);
  await exitEditor(page);

  await dragResizeFromRight(page, baseBox, targetWidth - baseBox.width);

  const editor = await openEditorByDoubleClickAt(page, createX, createY);
  await editor.waitFor();

  await page.evaluate(() => {
    const textarea = document.querySelector<HTMLTextAreaElement>(
      "textarea.excalidraw-wysiwyg",
    );
    if (!textarea) {
      throw new Error("missing textarea");
    }
    let idx = Math.floor(textarea.value.length / 2);
    if (textarea.value[idx] === "\n") {
      idx += 1;
    }
    idx = Math.max(1, Math.min(idx, textarea.value.length - 1));
    textarea.selectionStart = textarea.selectionEnd = idx;
  });

  const latencies: number[] = [];
  for (let i = 0; i < 10; i++) {
    const dt = await page.evaluate(
      (direction) => {
        const textarea = document.querySelector<HTMLTextAreaElement>(
          "textarea.excalidraw-wysiwyg",
        );
        if (!textarea) {
          throw new Error("missing textarea");
        }
        const t0 = performance.now();
        textarea.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: direction,
            altKey: true,
            bubbles: true,
            cancelable: true,
          }),
        );
        return performance.now() - t0;
      },
      i % 2 === 0 ? "ArrowUp" : "ArrowDown",
    );
    latencies.push(dt);
  }

  const p95 = percentile(latencies, 0.95);
  const p50 = percentile(latencies, 0.5);
  const max = Math.max(...latencies);
  process.stdout.write(
    `[response speed] Alt+ArrowUp/Down move line: p50=${p50.toFixed(
      1,
    )}ms p95=${p95.toFixed(1)}ms max=${max.toFixed(1)}ms n=${
      latencies.length
    }\n`,
  );
  expect(p95).toBeLessThan(500);
  expect(max).toBeLessThan(1000);

  await exitEditor(page);
});

// response speed
test("response speed: double click inserts caret (E2E)", async ({ page }) => {
  test.setTimeout(900_000);
  await page.goto("/");

  const createX = 240;
  const createY = 180;
  const targetWidth = 300;

  const value = generateRandomText(424242, 50_000);

  await openTextEditorAt(page, createX, createY);
  await page.evaluate((text) => {
    const textarea = document.querySelector<HTMLTextAreaElement>(
      "textarea.excalidraw-wysiwyg",
    );
    if (!textarea) {
      throw new Error("missing textarea");
    }
    textarea.value = String(text);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  }, value);
  await page.waitForFunction((len) => {
    const textarea = document.querySelector<HTMLTextAreaElement>(
      "textarea.excalidraw-wysiwyg",
    );
    return textarea?.value.length === Number(len);
  }, value.length);
  await exitEditor(page);

  const editorForBox = await openEditorByDoubleClickAt(page, createX, createY);
  await editorForBox.waitFor();
  const baseBox = await getEditorBox(page);
  await exitEditor(page);
  await dragResizeFromRight(page, baseBox, targetWidth - baseBox.width);

  const canvas = page.locator("canvas.interactive");
  await canvas.waitFor();

  await page.evaluate(() => {
    (window as any).__e2eDblClickResponseSpeed = {
      seq: 0,
      completedSeq: 0,
      latencyMs: 0,
    };

    if ((window as any).__e2eDblClickResponseSpeedInstalled) {
      return;
    }
    (window as any).__e2eDblClickResponseSpeedInstalled = true;

    document.addEventListener(
      "dblclick",
      () => {
        const s = (window as any).__e2eDblClickResponseSpeed;
        s.seq += 1;
        const activeSeq = s.seq;
        const t0 = performance.now();
        const loop = () => {
          const textarea = document.querySelector<HTMLTextAreaElement>(
            "textarea.excalidraw-wysiwyg",
          );
          if (textarea && document.activeElement === textarea) {
            s.latencyMs = performance.now() - t0;
            s.completedSeq = activeSeq;
            return;
          }
          requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
      },
      { capture: true },
    );
  });

  const latencies: number[] = [];
  for (let i = 0; i < 5; i++) {
    const expectedSeq = await page.evaluate(
      () => Number((window as any).__e2eDblClickResponseSpeed?.seq ?? 0) + 1,
    );

    await page.mouse.dblclick(createX + 50, createY + 10);

    await page.waitForFunction(
      (seq) => (window as any).__e2eDblClickResponseSpeed?.completedSeq === seq,
      expectedSeq,
    );

    await expect(page.locator("textarea.excalidraw-wysiwyg")).toBeVisible();

    const selection = await page.evaluate(() => {
      const textarea = document.querySelector<HTMLTextAreaElement>(
        "textarea.excalidraw-wysiwyg",
      );
      if (!textarea) {
        throw new Error("missing textarea");
      }
      return {
        start: textarea.selectionStart,
        end: textarea.selectionEnd,
        length: textarea.value.length,
      };
    });

    expect(selection.end).toBeGreaterThan(0);
    expect(selection.end).toBeLessThanOrEqual(selection.length);

    const dt = await page.evaluate(() =>
      Number((window as any).__e2eDblClickResponseSpeed?.latencyMs ?? NaN),
    );
    latencies.push(dt);

    await exitEditor(page);
  }

  const p95 = percentile(latencies, 0.95);
  const p50 = percentile(latencies, 0.5);
  const max = Math.max(...latencies);
  process.stdout.write(
    `[response speed] double click inserts caret: p50=${p50.toFixed(
      1,
    )}ms p95=${p95.toFixed(1)}ms max=${max.toFixed(1)}ms n=${
      latencies.length
    }\n`,
  );
  expect(p95).toBeLessThan(500);
  expect(max).toBeLessThan(1000);
});

//更新双击文本框插入编辑光标测试
//创建一个5000字符的随机文本文本框,随机换行,(包括汉字,字母,汉语符号,英语符号;)
//操作A
//从非选中状态开始
//第一次随机点击文本框的一个点;
//第二次点击精确点击文本框中某一行的某一个字符的左半部分,;
//查看是否将编辑光标插入在这个字符的后面,
//退出到非选中状态,
//再次随机点击文本框的一个点
//第二次点击精确点击文本框中某一行的某一个字符的右半部分;
//查看是否将编辑光标插入在这个字符的后面,
//操作B
//随机选取文本框中50个字符进行操作A,若操作A都通过,则操作B通过;
//两次点击时间差10ms;(第二次点击后如果没有插入正确的光标位置则测试失败;)
test("Double click the text box to insert the cursor (E2E)", async ({
  page,
}) => {
  test.setTimeout(900_000);
  await page.goto("/");

  const createX = 240;
  const createY = 180;
  const targetWidth = 300;

  const value = generateRandomText(424243, 5_000);

  const editor = await openTextEditorAt(page, createX, createY);
  await editor.fill(value);
  await exitEditor(page);

  const editorForBox = await openEditorByDoubleClickAt(page, createX, createY);
  await editorForBox.waitFor();
  const baseBox = await getEditorBox(page);
  await exitEditor(page);
  await dragResizeFromRight(page, baseBox, targetWidth - baseBox.width);

  const overlayCandidates = await openEditorByDoubleClickAt(
    page,
    createX,
    createY,
  );
  await overlayCandidates.waitFor();
  await expect(
    page.locator(".excalidraw-wysiwyg__whitespaceOverlay"),
  ).toBeVisible();

  const candidates = await page.evaluate(() => {
    const overlay = document.querySelector<HTMLElement>(
      ".excalidraw-wysiwyg__whitespaceOverlay",
    );
    const textarea = document.querySelector<HTMLTextAreaElement>(
      "textarea.excalidraw-wysiwyg",
    );
    if (!overlay || !textarea) {
      throw new Error("missing editor");
    }

    const text = textarea.value.replace(/\r\n?/g, "\n");
    const overlayRect = overlay.getBoundingClientRect();

    const inViewport = (x: number, y: number) =>
      x > 2 && x < window.innerWidth - 2 && y > 2 && y < window.innerHeight - 2;
    const inOverlay = (x: number, y: number) =>
      x > overlayRect.left + 2 &&
      x < overlayRect.right - 2 &&
      y > overlayRect.top + 2 &&
      y < overlayRect.bottom - 2;

    const getCharRect = (i: number) =>
      (window as any).__e2eOverlay.charRectAt(overlay, i) as DOMRect;

    let state = 20250316 >>> 0;
    const next = () => {
      state = (1664525 * state + 1013904223) >>> 0;
      return state;
    };

    const pickCharIndex = () => {
      for (let tries = 0; tries < 5000; tries++) {
        const i = next() % text.length;
        if (text[i] === "\n") {
          continue;
        }
        return i;
      }
      return 0;
    };

    const selectionPoints: Array<{ x: number; y: number }> = [];
    for (let i = 0; i < 20; i++) {
      const x =
        overlayRect.left + 5 + (next() % Math.max(1, overlayRect.width - 10));
      const y =
        overlayRect.top + 5 + (next() % Math.max(1, overlayRect.height - 10));
      if (inViewport(x, y) && inOverlay(x, y)) {
        selectionPoints.push({ x, y });
      }
    }
    if (selectionPoints.length === 0) {
      const x = (overlayRect.left + overlayRect.right) / 2;
      const y = (overlayRect.top + overlayRect.bottom) / 2;
      selectionPoints.push({ x, y });
    }

    const points: Array<{
      expected: number;
      left: { x: number; y: number };
      right: { x: number; y: number };
    }> = [];
    const seen = new Set<number>();
    for (let tries = 0; tries < 200_000 && points.length < 50; tries++) {
      const i = pickCharIndex();
      if (seen.has(i)) {
        continue;
      }
      seen.add(i);
      const r = getCharRect(i);
      if (!Number.isFinite(r.x) || !Number.isFinite(r.y) || r.width <= 0) {
        continue;
      }
      const y = r.y + Math.max(1, r.height / 2);
      const leftX = r.x + Math.max(1, r.width * 0.25);
      const rightX = r.x + Math.max(1, r.width * 0.75);
      if (
        !inViewport(leftX, y) ||
        !inViewport(rightX, y) ||
        !inOverlay(leftX, y) ||
        !inOverlay(rightX, y)
      ) {
        continue;
      }
      points.push({
        expected: i + 1,
        left: { x: leftX, y },
        right: { x: rightX, y },
      });
    }

    if (points.length < 50) {
      throw new Error(`insufficient candidates: ${points.length}`);
    }

    return { selectionPoints, points };
  });

  await exitEditor(page);

  const canvas = page.locator("canvas.interactive");
  await canvas.waitFor();

  const clickOnce = async (x: number, y: number) => {
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.up();
  };

  const ensureNonSelected = async () => {
    await canvas.click({ position: { x: 10, y: 10 } });
    await page.keyboard.press("Escape");
    await page.waitForTimeout(10);
    await page.waitForFunction(() => {
      const state = (window as any).h?.state;
      if (!state) {
        return false;
      }
      const ids = state.selectedElementIds || {};
      return Object.keys(ids).length === 0;
    });
  };

  const runSecondClickAndAssert = async (
    pt: { x: number; y: number },
    expected: number,
  ) => {
    await clickOnce(pt.x, pt.y);
    const textarea = page.locator("textarea.excalidraw-wysiwyg");
    await expect(textarea).toBeVisible();
    const selection = await page.evaluate(() => {
      const textarea = document.querySelector<HTMLTextAreaElement>(
        "textarea.excalidraw-wysiwyg",
      );
      if (!textarea) {
        throw new Error("missing textarea");
      }
      return {
        start: textarea.selectionStart,
        end: textarea.selectionEnd,
        length: textarea.value.length,
      };
    });
    expect(selection.start).toBe(selection.end);
    expect(selection.end).toBeGreaterThan(0);
    expect(selection.end).toBeLessThanOrEqual(selection.length);
    expect(selection.end).toBe(expected);
  };

  const gapMs = 10;
  for (let i = 0; i < 50; i++) {
    const pick = candidates.points[i]!;
    const seedIdx = (i * 7) % candidates.selectionPoints.length;
    const seedPoint = candidates.selectionPoints[seedIdx]!;

    await ensureNonSelected();
    await clickOnce(seedPoint.x, seedPoint.y);
    await page.waitForTimeout(gapMs);
    await runSecondClickAndAssert(pick.left, pick.expected);
    await exitEditor(page);
    await ensureNonSelected();

    await clickOnce(seedPoint.x, seedPoint.y);
    await page.waitForTimeout(gapMs);
    await runSecondClickAndAssert(pick.right, pick.expected);
    await exitEditor(page);
  }
});

//编写在编辑状态下点击文本框某一个字符插入光标在字符后面测试
//目前编辑画布中文本框时,点击字符的左半部分会将光标插入在字符左侧,点击字符右半部分会将字符插入在光标右侧;改为无论点击字符的左半部分还是右半部分都将光标插入到字符的右侧;
//文本框进入编辑状态时,点击文本框中某10个字符的位置的随机10个区域(包括这个字符的左半部分和右半部分),检查是否都将光标插入到这个字符的后面;
test("Click on the character to insert the cursor at the back (E2E)", async ({
  page,
}) => {
  test.setTimeout(900_000);
  await page.goto("/");

  const createX = 240;
  const createY = 180;
  const targetWidth = 300;

  const value = generateRandomText(424244, 5_000);

  const editor = await openTextEditorAt(page, createX, createY);
  await editor.fill(value);
  await exitEditor(page);

  const editorForBox = await openEditorByDoubleClickAt(page, createX, createY);
  await editorForBox.waitFor();
  const baseBox = await getEditorBox(page);
  await exitEditor(page);
  await dragResizeFromRight(page, baseBox, targetWidth - baseBox.width);

  const overlayCandidates = await openEditorByDoubleClickAt(
    page,
    createX,
    createY,
  );
  await overlayCandidates.waitFor();
  await expect(
    page.locator(".excalidraw-wysiwyg__whitespaceOverlay"),
  ).toBeVisible();

  const candidates = await page.evaluate(() => {
    const overlay = document.querySelector<HTMLElement>(
      ".excalidraw-wysiwyg__whitespaceOverlay",
    );
    const textarea = document.querySelector<HTMLTextAreaElement>(
      "textarea.excalidraw-wysiwyg",
    );
    if (!overlay || !textarea) {
      throw new Error("missing editor");
    }

    const text = textarea.value.replace(/\r\n?/g, "\n");
    const overlayRect = overlay.getBoundingClientRect();

    const inViewport = (x: number, y: number) =>
      x > 2 && x < window.innerWidth - 2 && y > 2 && y < window.innerHeight - 2;
    const inOverlay = (x: number, y: number) =>
      x > overlayRect.left + 2 &&
      x < overlayRect.right - 2 &&
      y > overlayRect.top + 2 &&
      y < overlayRect.bottom - 2;

    const getCharRect = (i: number) =>
      (window as any).__e2eOverlay.charRectAt(overlay, i) as DOMRect;

    let state = 20250317 >>> 0;
    const next = () => {
      state = (1664525 * state + 1013904223) >>> 0;
      return state;
    };
    const nextFloat = () => next() / 0xffffffff;

    const pickCharIndex = () => {
      for (let tries = 0; tries < 5000; tries++) {
        const i = next() % text.length;
        if (text[i] === "\n") {
          continue;
        }
        return i;
      }
      return 0;
    };

    const charIndices: number[] = [];
    const seen = new Set<number>();
    for (let tries = 0; tries < 50_000 && charIndices.length < 10; tries++) {
      const i = pickCharIndex();
      if (seen.has(i)) {
        continue;
      }
      seen.add(i);
      const r = getCharRect(i);
      if (!Number.isFinite(r.x) || !Number.isFinite(r.y) || r.width <= 0) {
        continue;
      }
      const cx = r.x + Math.max(1, r.width / 2);
      const cy = r.y + Math.max(1, r.height / 2);
      if (!inViewport(cx, cy) || !inOverlay(cx, cy)) {
        continue;
      }
      charIndices.push(i);
    }

    if (charIndices.length < 10) {
      throw new Error(`insufficient characters: ${charIndices.length}`);
    }

    const samples: Array<{ x: number; y: number; expected: number }> = [];
    for (const i of charIndices) {
      const r = getCharRect(i);
      const yBase = r.y + Math.max(1, r.height / 2);
      const leftMin = 0.15;
      const leftMax = 0.45;
      const rightMin = 0.55;
      const rightMax = 0.85;

      let produced = 0;
      for (let tries = 0; tries < 2000 && produced < 10; tries++) {
        const isLeft = produced < 5;
        const frac = isLeft
          ? leftMin + (leftMax - leftMin) * nextFloat()
          : rightMin + (rightMax - rightMin) * nextFloat();
        const yJitter = (nextFloat() - 0.5) * Math.max(1, r.height * 0.4);
        const x = r.x + Math.max(1, r.width * frac);
        const y = yBase + yJitter;
        if (!inViewport(x, y) || !inOverlay(x, y)) {
          continue;
        }
        samples.push({ x, y, expected: i + 1 });
        produced++;
      }
      if (produced < 10) {
        throw new Error(`insufficient points for char=${i}: ${produced}`);
      }
    }

    return { samples };
  });

  const clickOnce = async (x: number, y: number) => {
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.up();
  };

  for (const s of candidates.samples) {
    await clickOnce(s.x, s.y);
    const textarea = page.locator("textarea.excalidraw-wysiwyg");
    await expect(textarea).toBeVisible();
    const selection = await page.evaluate(() => {
      const textarea = document.querySelector<HTMLTextAreaElement>(
        "textarea.excalidraw-wysiwyg",
      );
      if (!textarea) {
        throw new Error("missing textarea");
      }
      return {
        start: textarea.selectionStart,
        end: textarea.selectionEnd,
        length: textarea.value.length,
      };
    });
    expect(selection.start).toBe(selection.end);
    expect(selection.end).toBeGreaterThan(0);
    expect(selection.end).toBeLessThanOrEqual(selection.length);
    expect(selection.end).toBe(s.expected);
    await page.waitForTimeout(50);
  }
});
//双击选词间隔(ms)三击选行间隔(ms)精确度测试
//excalidraw.dblClickSelectWordIntervalMs 默认 200 ，并被 Math.floor 且 clamp 到 [1, 2000] （见 textWysiwyg.tsx ）。
test("Double click selects word and triple click selects line using configured intervals (E2E)", async ({
  page,
}) => {
  test.setTimeout(120_000);

  const dblMs = 2000;
  const tripleMs = 2000;
  const withinMs = 1500;
  const outsideMs = 2500;

  await page.addInitScript(
    ({ dblMs, tripleMs }) => {
      localStorage.setItem(
        "excalidraw.dblClickSelectWordIntervalMs",
        String(dblMs),
      );
      localStorage.setItem(
        "excalidraw.tripleClickSelectLineIntervalMs",
        String(tripleMs),
      );
    },
    { dblMs, tripleMs },
  );

  await page.goto("/");

  const createX = 240;
  const createY = 180;
  const value = "alpha beta gamma\nsecond line words\nthird";

  const editor = await openTextEditorAt(page, createX, createY);
  await editor.fill(value);
  await expect(
    page.locator(".excalidraw-wysiwyg__whitespaceOverlay"),
  ).toBeVisible();
  await exitEditor(page);

  await openEditorByDoubleClickAt(page, createX, createY);
  await expect(
    page.locator(".excalidraw-wysiwyg__whitespaceOverlay"),
  ).toBeVisible();

  await page.evaluate(() => {
    (window as any).__e2eNativeDblClickCount = 0;
    (window as any).__e2eCountdown = { word: null, line: null };
    const textarea = document.querySelector<HTMLTextAreaElement>(
      "textarea.excalidraw-wysiwyg",
    );
    if (!textarea) {
      throw new Error("missing textarea");
    }
    textarea.addEventListener(
      "dblclick",
      () => {
        (window as any).__e2eNativeDblClickCount += 1;
      },
      { capture: true },
    );

    window.addEventListener(
      "excalidraw:selectWordCountdown",
      (event: any) => {
        (window as any).__e2eCountdown.word = event?.detail ?? null;
      },
      { capture: true },
    );
    window.addEventListener(
      "excalidraw:selectLineCountdown",
      (event: any) => {
        (window as any).__e2eCountdown.line = event?.detail ?? null;
      },
      { capture: true },
    );
  });

  const target = await page.evaluate(() => {
    const overlay = document.querySelector<HTMLElement>(
      ".excalidraw-wysiwyg__whitespaceOverlay",
    );
    const textarea = document.querySelector<HTMLTextAreaElement>(
      "textarea.excalidraw-wysiwyg",
    );
    if (!overlay || !textarea) {
      throw new Error("missing editor");
    }
    const normalized = textarea.value.replace(/\r\n?/g, "\n");
    const word = "beta";
    const wordStart = normalized.indexOf(word);
    if (wordStart < 0) {
      throw new Error("missing beta");
    }

    const pivotIndex = wordStart + 1;
    const r = (window as any).__e2eOverlay.charRectAt(overlay, pivotIndex) as
      | DOMRect
      | { x: number; y: number; width: number; height: number };
    if (!Number.isFinite(r.x) || !Number.isFinite(r.y) || r.width <= 0) {
      throw new Error("invalid target rect");
    }

    const x = r.x + Math.max(1, r.width / 2);
    const y = r.y + Math.max(1, r.height / 2);
    const lineEndIdx = normalized.indexOf("\n");
    const lineEnd = lineEndIdx === -1 ? normalized.length : lineEndIdx;

    return {
      x,
      y,
      caretAfter: pivotIndex + 1,
      wordStart,
      wordEnd: wordStart + word.length,
      lineStart: 0,
      lineEnd,
    };
  });

  const clickOnce = async () => {
    await page.mouse.move(target.x, target.y);
    await page.mouse.down();
    await page.mouse.up();
  };

  const getSelection = async () => {
    return page.evaluate(() => {
      const textarea = document.querySelector<HTMLTextAreaElement>(
        "textarea.excalidraw-wysiwyg",
      );
      if (!textarea) {
        throw new Error("missing textarea");
      }
      return {
        start: textarea.selectionStart,
        end: textarea.selectionEnd,
      };
    });
  };

  await page.waitForTimeout(outsideMs);
  await page.evaluate(() => {
    (window as any).__e2eNativeDblClickCount = 0;
    (window as any).__e2eCountdown.word = null;
    (window as any).__e2eCountdown.line = null;
  });
  await page.evaluate((caretAfter) => {
    const textarea = document.querySelector<HTMLTextAreaElement>(
      "textarea.excalidraw-wysiwyg",
    );
    if (!textarea) {
      throw new Error("missing textarea");
    }
    textarea.focus();
    textarea.selectionStart = caretAfter;
    textarea.selectionEnd = caretAfter;
  }, target.caretAfter);

  await clickOnce();
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as any).__e2eCountdown?.word?.durationMs ?? null,
      ),
    )
    .toBe(dblMs);
  {
    const sel = await getSelection();
    expect(sel.start).toBe(sel.end);
    expect(sel.end).toBe(target.caretAfter);
  }
  expect(
    await page.evaluate(
      () => (window as any).__e2eCountdown?.line?.durationMs ?? null,
    ),
  ).toBe(null);
  await page.waitForTimeout(withinMs);
  await clickOnce();
  expect(await getSelection()).toEqual({
    start: target.wordStart,
    end: target.wordEnd,
  });
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as any).__e2eCountdown?.line?.durationMs ?? null,
      ),
    )
    .toBe(tripleMs);

  await page.waitForTimeout(withinMs);
  await page.evaluate((caretAfter) => {
    const textarea = document.querySelector<HTMLTextAreaElement>(
      "textarea.excalidraw-wysiwyg",
    );
    if (!textarea) {
      throw new Error("missing textarea");
    }
    textarea.selectionStart = caretAfter;
    textarea.selectionEnd = caretAfter;
  }, target.caretAfter);
  await clickOnce();
  expect(await getSelection()).toEqual({
    start: target.lineStart,
    end: target.lineEnd,
  });

  await clickOnce();
  {
    const sel = await getSelection();
    expect(sel.start).toBe(sel.end);
    expect(sel.end).toBe(target.caretAfter);
  }

  await page.waitForTimeout(outsideMs);
  await clickOnce();
  {
    const sel = await getSelection();
    expect(sel.start).toBe(sel.end);
    expect(sel.end).toBe(target.caretAfter);
  }

  await page.waitForTimeout(outsideMs);
  await clickOnce();
  await page.waitForTimeout(withinMs);
  await clickOnce();
  expect(await getSelection()).toEqual({
    start: target.wordStart,
    end: target.wordEnd,
  });

  await page.waitForTimeout(outsideMs);
  await clickOnce();
  {
    const sel = await getSelection();
    expect(sel.start).toBe(sel.end);
    expect(sel.end).toBe(target.caretAfter);
  }

  await expect
    .poll(() => page.evaluate(() => (window as any).__e2eNativeDblClickCount))
    .toBe(0);

  await exitEditor(page);
});

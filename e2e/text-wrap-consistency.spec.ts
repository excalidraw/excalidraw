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

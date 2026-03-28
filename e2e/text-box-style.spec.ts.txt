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

  // override global for E2E
  // 覆盖全局 createImageBitmap 以用于 E2E 测试
  if (typeof createImageBitmap === "function") {
    const origCreate = createImageBitmap;
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

const openEditorByDoubleClickAt = async (page: Page, x: number, y: number) => {
  await selectTool(page, "selection");
  const canvas = page.locator("canvas.interactive");
  await canvas.dblclick({ position: { x, y } });
  const editor = page.locator("textarea.excalidraw-wysiwyg");
  await expect(editor).toBeVisible();
  return editor;
};

const exitEditor = async (page: Page) => {
  const editor = page.locator("textarea.excalidraw-wysiwyg");
  await editor.press("Escape");
  await expect(editor).toHaveCount(0);
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

const getLastTextElementId = async (page: Page) => {
  return page.evaluate(() => {
    const h = (window as any).h;
    const els = h?.elements || [];
    const text = [...els].reverse().find((e: any) => e?.type === "text");
    if (!text) {
      throw new Error("missing text element");
    }
    return String(text.id);
  });
};

const getCanvasRegionStatsForTextElement = async (
  page: Page,
  elementId: string,
  canvasSelector: string,
) => {
  return page.evaluate(
    ({ elementId, canvasSelector }) => {
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

      const canvas = document.querySelector<HTMLCanvasElement>(canvasSelector);
      if (!canvas) {
        throw new Error("missing static canvas");
      }
      const rect = canvas.getBoundingClientRect();
      const scaleX = rect.width ? canvas.width / rect.width : 1;
      const scaleY = rect.height ? canvas.height / rect.height : 1;

      const originalText = String(el.originalText ?? el.text ?? "");
      const normalizedText = originalText.replace(/\r\n?/g, "\n");
      const logicalLineCount = normalizedText.split("\n").length;
      const digits = String(Math.max(1, logicalLineCount)).length;
      const lineNumberFontSize = Math.max(10, Number(el.fontSize) * 0.8);
      const lineNumberGutterWidthEstimate =
        lineNumberFontSize * (digits * 0.65 + 1.2);
      const paddingScene =
        Number(el.fontSize) / 2 + lineNumberGutterWidthEstimate;

      const paddingClientPx = 6;
      const leftClient =
        (el.x - paddingScene + state.scrollX) * zoom +
        state.offsetLeft -
        paddingClientPx;
      const topClient =
        (el.y - paddingScene + state.scrollY) * zoom +
        state.offsetTop -
        paddingClientPx;
      const widthClient =
        (el.width + paddingScene * 2) * zoom + paddingClientPx * 2;
      const heightClient =
        (el.height + paddingScene * 2) * zoom + paddingClientPx * 2;

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
        hash ^= BigInt(data[i]!);
        hash = (hash * prime) & 18446744073709551615n;
      }

      let gutterInkCount = 0;
      const elementLeftPx = Math.max(
        0,
        Math.min(
          sw,
          Math.floor((paddingScene * zoom + paddingClientPx) * scaleX),
        ),
      );
      const stripeRight = Math.max(0, elementLeftPx - Math.ceil(2 * scaleX));
      const stripeWidth = Math.max(
        6,
        Math.ceil(lineNumberFontSize * zoom * scaleX * 2),
      );
      const stripeLeft = Math.max(0, stripeRight - stripeWidth);
      let totalInkCount = 0;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i]!;
        const g = data[i + 1]!;
        const b = data[i + 2]!;
        const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        if (lum < 240) {
          totalInkCount += 1;
        }
      }
      if (stripeRight > stripeLeft) {
        for (let y = 0; y < sh; y++) {
          const rowOffset = y * sw * 4;
          for (let x = stripeLeft; x < stripeRight; x++) {
            const idx = rowOffset + x * 4;
            const r = data[idx]!;
            const g = data[idx + 1]!;
            const b = data[idx + 2]!;
            const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
            if (lum < 240) {
              gutterInkCount += 1;
            }
          }
        }
      }

      return {
        region: `${sw}x${sh}`,
        hash: hash.toString(16),
        gutterInkCount,
        totalInkCount,
      };
    },
    { elementId, canvasSelector },
  );
};

const getPreferredCanvasSelectorForTextElement = async (
  page: Page,
  elementId: string,
) => {
  const staticSelector = "canvas.excalidraw__canvas.static";
  const interactiveSelector = "canvas.excalidraw__canvas.interactive";
  const staticStats = await getCanvasRegionStatsForTextElement(
    page,
    elementId,
    staticSelector,
  );
  if (staticStats.totalInkCount > 0) {
    return staticSelector;
  }
  return interactiveSelector;
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(installCanvasTextSpy);
});

test("text box style: view and edit render identically (E2E)", async ({
  page,
}) => {
  await page.goto("/");
  await page.addStyleTag({
    content:
      "canvas.excalidraw__canvas.interactive{opacity:0 !important;} .excalidraw__canvas.interactive{opacity:0 !important;}",
  });
  await page.evaluate(() => {
    (window as any).h?.setState?.({
      currentItemFontFamily: 12,
      currentItemFontSize: 20,
      gridModeEnabled: false,
    });
  });

  const createX = 240;
  const createY = 180;
  const value = "AA  BB\nCC   DD\nEE";

  const editor = await openTextEditorAt(page, createX, createY);
  await editor.fill(value);
  await exitEditor(page);

  const textElementId = await getLastTextElementId(page);
  await page
    .locator("canvas.interactive")
    .click({ position: { x: 10, y: 10 } });
  const canvasSelector = await getPreferredCanvasSelectorForTextElement(
    page,
    textElementId,
  );
  let beforeStats = await getCanvasRegionStatsForTextElement(
    page,
    textElementId,
    canvasSelector,
  );
  for (let i = 0; i < 20 && beforeStats.totalInkCount === 0; i++) {
    await page.waitForTimeout(50);
    beforeStats = await getCanvasRegionStatsForTextElement(
      page,
      textElementId,
      canvasSelector,
    );
  }
  expect(beforeStats.totalInkCount).toBeGreaterThan(0);
  expect(beforeStats.gutterInkCount).toBeGreaterThan(20);

  await openEditorByDoubleClickAt(page, createX, createY);
  await page.evaluate(() => {
    const textarea = document.querySelector<HTMLTextAreaElement>(
      "textarea.excalidraw-wysiwyg",
    );
    if (!textarea) {
      throw new Error("missing textarea");
    }
    textarea.selectionStart = textarea.selectionEnd = textarea.value.length;
  });
  const duringStats = await getCanvasRegionStatsForTextElement(
    page,
    textElementId,
    canvasSelector,
  );
  expect(duringStats.region).toBe(beforeStats.region);
  expect(duringStats.totalInkCount).toBeGreaterThan(0);
  expect(duringStats.gutterInkCount).toBeGreaterThan(20);
  expect(
    Math.abs(duringStats.totalInkCount - beforeStats.totalInkCount),
  ).toBeLessThan(800);
  expect(
    Math.abs(duringStats.gutterInkCount - beforeStats.gutterInkCount),
  ).toBeLessThan(800);
  await exitEditor(page);
});

test("text box style: soft wrap does not add line numbers (E2E)", async ({
  page,
}) => {
  await page.goto("/");
  await page.addStyleTag({
    content:
      "canvas.excalidraw__canvas.interactive{opacity:0 !important;} .excalidraw__canvas.interactive{opacity:0 !important;}",
  });
  await page.evaluate(() => {
    (window as any).h?.setState?.({
      currentItemFontFamily: 12,
      currentItemFontSize: 24,
      gridModeEnabled: false,
    });
  });

  const createX = 240;
  const createY = 180;

  const value =
    "alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu nu xi omicron\nshort";

  const editor = await openTextEditorAt(page, createX, createY);
  await editor.fill(value);
  await exitEditor(page);
  const elementId = await getLastTextElementId(page);
  await page
    .locator("canvas.interactive")
    .click({ position: { x: 10, y: 10 } });

  const canvasSelector = await getPreferredCanvasSelectorForTextElement(
    page,
    elementId,
  );
  let before = await getCanvasRegionStatsForTextElement(
    page,
    elementId,
    canvasSelector,
  );
  for (let i = 0; i < 20 && before.totalInkCount === 0; i++) {
    await page.waitForTimeout(50);
    before = await getCanvasRegionStatsForTextElement(
      page,
      elementId,
      canvasSelector,
    );
  }
  expect(before.totalInkCount).toBeGreaterThan(0);
  expect(before.gutterInkCount).toBeGreaterThan(20);

  await page.evaluate(() => (window as any).__e2eCanvasText.clear());
  await toggleTheme(page);
  await waitForCanvasTextCalls(page);
  await toggleTheme(page);

  const lineNumbersBefore = await page.evaluate(() => {
    const calls = (window as any).__e2eCanvasText?.get?.() || [];
    const nums = calls
      .filter(
        (c: any) =>
          c?.kind === "fillText" &&
          typeof c?.x === "number" &&
          c.x < 0 &&
          /^\d+$/.test(String(c.text)),
      )
      .map((c: any) => String(c.text));
    return Array.from(new Set(nums));
  });
  expect(new Set(lineNumbersBefore)).toEqual(new Set(["1", "2"]));

  const editorForBox = await openEditorByDoubleClickAt(page, createX, createY);
  await editorForBox.waitFor();
  const baseBox = await getEditorBox(page);
  await exitEditor(page);
  await dragResizeFromRight(page, baseBox, -220);
  await page
    .locator("canvas.interactive")
    .click({ position: { x: 10, y: 10 } });

  let after = await getCanvasRegionStatsForTextElement(
    page,
    elementId,
    canvasSelector,
  );
  for (let i = 0; i < 20 && after.totalInkCount === 0; i++) {
    await page.waitForTimeout(50);
    after = await getCanvasRegionStatsForTextElement(
      page,
      elementId,
      canvasSelector,
    );
  }

  expect(after.totalInkCount).toBeGreaterThan(0);
  expect(after.gutterInkCount).toBeGreaterThan(20);

  await page.evaluate(() => (window as any).__e2eCanvasText.clear());
  await toggleTheme(page);
  await waitForCanvasTextCalls(page);
  await toggleTheme(page);

  const lineNumbersAfter = await page.evaluate(() => {
    const calls = (window as any).__e2eCanvasText?.get?.() || [];
    const nums = calls
      .filter(
        (c: any) =>
          c?.kind === "fillText" &&
          typeof c?.x === "number" &&
          c.x < 0 &&
          /^\d+$/.test(String(c.text)),
      )
      .map((c: any) => String(c.text));
    return Array.from(new Set(nums));
  });
  expect(new Set(lineNumbersAfter)).toEqual(new Set(["1", "2"]));
});

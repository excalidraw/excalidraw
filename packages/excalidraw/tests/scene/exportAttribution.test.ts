import { exportToCanvas, exportToSvg } from "@excalidraw/utils";

import { applyDarkModeFilter } from "@excalidraw/common";

import { actionCopyAsPng, actionCopyAsSvg } from "../../actions";
import { copyBlobToClipboardAsPng } from "../../clipboard";
import {
  actionChangeExportWithAttribution,
  getExportAttributionLabel,
} from "../../actions/actionExport";
import { getDefaultAppState } from "../../appState";
import {
  defaultLang,
  getLanguage,
  hasOwnTranslation,
  languages,
  setLanguage,
} from "../../i18n";
import {
  EXPORT_ATTRIBUTION_TEXT,
  getExportAttributionFontSize,
  getExportAttributionUrl,
} from "../../scene/exportAttribution";
import { API } from "../helpers/api";

import type { AppState } from "../../types";

const createRectangle = (width = 200, height = 100) =>
  API.createElement({ type: "rectangle", x: 0, y: 0, width, height });

const getBadge = (svg: SVGSVGElement) =>
  svg.querySelector<SVGAElement>("a.excalidraw-attribution");

const getBadgeText = (svg: SVGSVGElement) =>
  getBadge(svg)?.querySelector("text") ?? null;

const getFillTextCalls = (canvas: HTMLCanvasElement) =>
  (canvas.getContext("2d") as any)
    .__getEvents()
    .filter((event: any) => event.type === "fillText")
    .map((event: any) => event.props.text);

describe("export attribution badge", () => {
  it("is off by default in the npm package", () => {
    expect(getDefaultAppState().exportWithAttribution).toBe(false);
  });

  it("reads excalidraw.com", () => {
    expect(EXPORT_ATTRIBUTION_TEXT).toBe("excalidraw.com");
  });

  it("grows with large diagrams and stays within limits", () => {
    expect(getExportAttributionFontSize(200, 100)).toBe(12);
    expect(getExportAttributionFontSize(1000, 200)).toBe(15);
    expect(getExportAttributionFontSize(5000, 3000)).toBe(32);
  });

  describe("exportToSvg", () => {
    it("is not added unless explicitly requested", async () => {
      // app state alone must not turn it on, so thumbnails and previews that
      // spread the editor's app state never get a badge
      const svg = await exportToSvg({
        elements: [createRectangle()],
        files: null,
        appState: { exportWithAttribution: true },
      });

      expect(getBadge(svg)).toBeNull();
    });

    it("adds a clickable badge below the drawing", async () => {
      const elements = [createRectangle()];
      const withoutBadge = await exportToSvg({ elements, files: null });
      const svg = await exportToSvg({
        elements,
        files: null,
        exportWithAttribution: true,
      });

      const badge = getBadge(svg);
      expect(badge).not.toBeNull();
      expect(badge!.getAttribute("href")).toBe(getExportAttributionUrl("svg"));
      expect(badge!.getAttribute("href")).toContain("utm_medium=export");
      expect(badge!.getAttribute("target")).toBe("_blank");
      expect(badge!.getAttribute("rel")).toContain("noopener");
      expect(getBadgeText(svg)!.textContent).toBe(EXPORT_ATTRIBUTION_TEXT);
      expect(badge!.querySelector("path")).not.toBeNull();

      // the export grows so the badge never covers the drawing
      const drawingBottom = Number(withoutBadge.getAttribute("height"));
      expect(Number(svg.getAttribute("height"))).toBeGreaterThan(drawingBottom);
      expect(Number(getBadgeText(svg)!.getAttribute("y"))).toBeGreaterThan(
        drawingBottom,
      );
    });

    it("widens tiny exports so the badge fits", async () => {
      const svg = await exportToSvg({
        elements: [createRectangle(10, 10)],
        files: null,
        exportWithAttribution: true,
      });

      const width = Number(svg.getAttribute("width"));
      const textRight = Number(getBadgeText(svg)!.getAttribute("x"));
      expect(textRight).toBeLessThanOrEqual(width);
      expect(width).toBeGreaterThan(30);
    });

    it("follows dark mode", async () => {
      const elements = [createRectangle()];
      const light = await exportToSvg({
        elements,
        files: null,
        exportWithAttribution: true,
      });
      const dark = await exportToSvg({
        elements,
        files: null,
        appState: { exportWithDarkMode: true },
        exportWithAttribution: true,
      });

      expect(getBadgeText(light)!.getAttribute("fill")).toBe("#46464f");
      expect(getBadgeText(dark)!.getAttribute("fill")).toBe(
        applyDarkModeFilter("#46464f"),
      );
    });

    it("stays readable on custom background colours", async () => {
      const elements = [createRectangle()];
      const darkBackground = await exportToSvg({
        elements,
        files: null,
        appState: { exportBackground: true, viewBackgroundColor: "#1e1e1e" },
        exportWithAttribution: true,
      });
      // in dark mode a dark background is painted light, so the text is dark
      const darkBackgroundInDarkMode = await exportToSvg({
        elements,
        files: null,
        appState: {
          exportBackground: true,
          exportWithDarkMode: true,
          viewBackgroundColor: "#1e1e1e",
        },
        exportWithAttribution: true,
      });

      expect(getBadgeText(darkBackground)!.getAttribute("fill")).toBe(
        applyDarkModeFilter("#46464f"),
      );
      expect(getBadgeText(darkBackgroundInDarkMode)!.getAttribute("fill")).toBe(
        "#46464f",
      );
    });

    it("adds an outline only on transparent exports", async () => {
      const elements = [createRectangle()];
      const transparent = await exportToSvg({
        elements,
        files: null,
        appState: { exportBackground: false },
        exportWithAttribution: true,
      });
      const withBackground = await exportToSvg({
        elements,
        files: null,
        appState: { exportBackground: true, viewBackgroundColor: "#ffffff" },
        exportWithAttribution: true,
      });

      expect(getBadgeText(transparent)!.getAttribute("stroke")).toBeTruthy();
      expect(getBadgeText(withBackground)!.getAttribute("stroke")).toBeNull();
    });
  });

  describe("exportToCanvas", () => {
    it("draws the badge only when requested", async () => {
      const elements = [createRectangle()];
      const withoutBadge = await exportToCanvas({ elements, files: null });
      const canvas = await exportToCanvas({
        elements,
        files: null,
        exportWithAttribution: true,
      });

      expect(getFillTextCalls(withoutBadge)).not.toContain(
        EXPORT_ATTRIBUTION_TEXT,
      );
      expect(getFillTextCalls(canvas)).toContain(EXPORT_ATTRIBUTION_TEXT);
      expect(canvas.height).toBeGreaterThan(withoutBadge.height);
    });
  });

  describe("switch label", () => {
    const initialLanguage = getLanguage();
    afterEach(async () => {
      await setLanguage(initialLanguage);
    });

    it("invites people to keep the badge on", async () => {
      await setLanguage(defaultLang);
      const { label, tooltip } = getExportAttributionLabel();
      expect(label).toBe("Give Excalidraw a nod");
      expect(tooltip).toContain("free and open source");
    });

    it("treats empty (untranslated) text as missing", async () => {
      // Crowdin writes untranslated keys as "", e.g. addWatermark in kk-KZ
      await setLanguage({ code: "kk-KZ", label: "Қазақ тілі" });
      expect(hasOwnTranslation("labels.addWatermark")).toBe(false);
      expect(hasOwnTranslation("labels.language")).toBe(true);
    });

    it("keeps the translated label in languages without the new text", async () => {
      await setLanguage(languages.find((lang) => lang.code === "es-ES")!);
      expect(getExportAttributionLabel()).toEqual({
        label: 'Agregar "Hecho con Excalidraw"',
        tooltip: undefined,
      });
    });
  });

  describe("tracking", () => {
    const appState = (exportWithAttribution: boolean) =>
      ({ ...getDefaultAppState(), exportWithAttribution } as AppState);

    it("counts copies to the clipboard as exports", () => {
      for (const action of [actionCopyAsPng, actionCopyAsSvg]) {
        expect(action.trackEvent && action.trackEvent.category).toBe("export");
      }
    });

    it("records whether the badge was on", () => {
      const trackEvent = actionCopyAsPng.trackEvent;
      if (!trackEvent) {
        throw new Error("copyAsPng should be tracked");
      }
      expect(trackEvent.getLabelSuffix?.(appState(true))).toBe(
        "attribution:on",
      );
      expect(trackEvent.getLabelSuffix?.(appState(false))).toBe(
        "attribution:off",
      );

      const toggle = actionChangeExportWithAttribution.trackEvent;
      if (!toggle) {
        throw new Error("the badge toggle should be tracked");
      }
      expect(toggle.getLabelSuffix?.(appState(true), false)).toBe(
        "attribution:off",
      );
    });
  });

  describe("copy to clipboard", () => {
    const readBlob = (blob: Blob) =>
      new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsText(blob);
      });

    let written: Record<string, Blob | Promise<Blob>>[] = [];
    let write: ReturnType<typeof vi.fn>;
    const originalClipboard = Object.getOwnPropertyDescriptor(
      navigator,
      "clipboard",
    );

    beforeEach(() => {
      written = [];
      write = vi.fn(async (items: { data: Record<string, any> }[]) => {
        written.push(items[0].data);
      });
      vi.stubGlobal(
        "ClipboardItem",
        class {
          constructor(public data: Record<string, any>) {}
        },
      );
      Object.defineProperty(navigator, "clipboard", {
        value: { write },
        configurable: true,
      });
    });

    afterEach(() => {
      vi.unstubAllGlobals();
      if (originalClipboard) {
        Object.defineProperty(navigator, "clipboard", originalClipboard);
      } else {
        delete (navigator as any).clipboard;
      }
    });

    const png = () =>
      new Blob([new Uint8Array([137, 80, 78, 71])], { type: "image/png" });
    const link = {
      href: getExportAttributionUrl("clipboard"),
      alt: "Diagram made with excalidraw.com",
      canvas: { width: 1640, height: 274 } as HTMLCanvasElement,
      scale: 2,
    };

    it("copies a linked version of the image when the badge is on", async () => {
      await copyBlobToClipboardAsPng(png(), link);

      expect(write).toHaveBeenCalledTimes(1);
      expect(Object.keys(written[0])).toEqual(["image/png", "text/html"]);
      const html = await readBlob(await written[0]["text/html"]);
      expect(html).toContain(
        'href="https://excalidraw.com/?utm_source=excalidraw&amp;utm_medium=export&amp;utm_content=clipboard"',
      );
      expect(html).toContain('src="data:image/png;base64,');
      // sized at 1x even when exported at 2x
      expect(html).toContain('width="820" height="137"');
    });

    it("copies the image alone without a link", async () => {
      await copyBlobToClipboardAsPng(png());

      expect(write).toHaveBeenCalledTimes(1);
      expect(Object.keys(written[0])).toEqual(["image/png"]);
    });

    it("falls back to the image alone if the linked version is rejected", async () => {
      write.mockRejectedValueOnce(new Error("text/html not supported"));
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

      await copyBlobToClipboardAsPng(png(), link);

      expect(write).toHaveBeenCalledTimes(2);
      expect(Object.keys(written[0])).toEqual(["image/png"]);
      warn.mockRestore();
    });
  });
});

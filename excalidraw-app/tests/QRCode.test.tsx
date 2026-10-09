import { render, screen, waitFor } from "@testing-library/react";
import { renderSVG } from "uqr";
import { vi } from "vitest";

import {
  EXCALIDRAW_BRAND_COLOR,
  EXCALIDRAW_LOGO_PATH_D,
} from "@excalidraw/common";

import { generateQRCodeSVG } from "../share/qrcode.chunk";
import { QRCode } from "../share/QRCode";

// wrap the real implementation so we can assert on call args (e.g. `ecc`)
// while keeping genuine QR output for the other assertions below.
vi.mock("uqr", async (importOriginal) => {
  const actual = await importOriginal<typeof import("uqr")>();
  return {
    ...actual,
    renderSVG: vi.fn(actual.renderSVG),
  };
});

describe("collaboration QR code branding", () => {
  describe("generateQRCodeSVG()", () => {
    it("requests error correction level H so the centered logo doesn't hurt scannability", () => {
      generateQRCodeSVG("https://excalidraw.com/#room=abcd,efgh");

      expect(renderSVG).toHaveBeenCalledWith(
        "https://excalidraw.com/#room=abcd,efgh",
        expect.objectContaining({ ecc: "H" }),
      );
    });

    it("embeds the official Excalidraw logo centered inside the QR code", () => {
      const svg = generateQRCodeSVG(
        "https://excalidraw.com/#room=abcd,efgh,secret",
      );

      // the brand logo path is embedded verbatim
      expect(svg).toContain(EXCALIDRAW_LOGO_PATH_D);
      expect(svg).toContain(EXCALIDRAW_BRAND_COLOR);
      // a white "quiet zone" badge sits behind the logo mark
      expect(svg).toMatch(/<rect[^>]*fill="#fff"/);
      // logo overlay is layered on top of the QR modules, before the closing tag
      expect(svg.trim().endsWith("</svg>")).toBe(true);
    });

    it("centers the logo badge within the QR code's bounding box", () => {
      const svg = generateQRCodeSVG("short-value");

      const [, width, height] = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/)!;
      const [, badgeX, badgeY, badgeWidth, badgeHeight] = svg.match(
        /<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)"/,
      )!;

      const totalWidth = Number(width);
      const totalHeight = Number(height);

      // badge should be horizontally and vertically centered
      expect(Number(badgeX) + Number(badgeWidth) / 2).toBeCloseTo(
        totalWidth / 2,
        5,
      );
      expect(Number(badgeY) + Number(badgeHeight) / 2).toBeCloseTo(
        totalHeight / 2,
        5,
      );
    });
  });

  describe("<QRCode />", () => {
    it("renders the collaboration link as a QR code with the embedded logo", async () => {
      const { container } = render(
        <QRCode value="https://excalidraw.com/#room=abcd,efgh,secret" />,
      );

      await waitFor(() => {
        expect(container.querySelector("svg")).not.toBeNull();
      });

      expect(container.innerHTML).toContain(EXCALIDRAW_LOGO_PATH_D);
      expect(
        screen.getByRole("img", { name: /qr code for collaboration link/i }),
      ).toBeInTheDocument();
    });
  });
});

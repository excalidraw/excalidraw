import React from "react";
import tEXt from "png-chunk-text";
import decodePng from "png-chunks-extract";
import encodePng from "png-chunks-encode";

import { SVG_NS, MIME_TYPES } from "@excalidraw/common";

import type { FileId } from "@excalidraw/element/types";

import { getDefaultAppState } from "../appState";
import { getDataURL, blobToArrayBuffer } from "../data/blob";
import { encode } from "../data/encode";
import { encodePngMetadata } from "../data/image";
import { serializeAsJSON } from "../data/json";
import { Excalidraw } from "../index";
import {
  decodeSvgBase64Payload,
  encodeSvgBase64Payload,
  exportToSvg,
} from "../scene/export";

import { API } from "./helpers/api";
import { render, waitFor } from "./test-utils";

const { h } = window;

const testElements = [
  {
    ...API.createElement({
      type: "text",
      id: "A",
      text: "😀",
    }),
    // can't get jsdom text measurement to work so this is a temp hack
    // to ensure the element isn't stripped as invisible
    width: 16,
    height: 16,
  },
];

// tiny polyfill for TextDecoder.decode on which we depend.
// Must actually decode UTF-8 (not just map each byte to a char code),
// since it needs to correctly invert the real (non-polyfilled)
// TextEncoder's multi-byte output for the iTXt PNG chunk round-trip.
Object.defineProperty(window, "TextDecoder", {
  value: class TextDecoder {
    private encoding: string;
    constructor(encoding = "utf-8") {
      this.encoding = encoding.toLowerCase();
    }
    decode(ab: ArrayBuffer) {
      const bytes = new Uint8Array(ab);
      if (this.encoding === "latin1" || this.encoding === "iso-8859-1") {
        return bytes.reduce((acc, c) => acc + String.fromCharCode(c), "");
      }
      // utf-8 (default)
      let result = "";
      let i = 0;
      while (i < bytes.length) {
        const byte1 = bytes[i++];
        if (byte1 < 0x80) {
          result += String.fromCharCode(byte1);
        } else if (byte1 >> 5 === 0b110) {
          const byte2 = bytes[i++];
          result += String.fromCharCode(
            ((byte1 & 0x1f) << 6) | (byte2 & 0x3f),
          );
        } else if (byte1 >> 4 === 0b1110) {
          const byte2 = bytes[i++];
          const byte3 = bytes[i++];
          result += String.fromCharCode(
            ((byte1 & 0x0f) << 12) | ((byte2 & 0x3f) << 6) | (byte3 & 0x3f),
          );
        } else if (byte1 >> 3 === 0b11110) {
          const byte2 = bytes[i++];
          const byte3 = bytes[i++];
          const byte4 = bytes[i++];
          const codepoint =
            ((byte1 & 0x07) << 18) |
            ((byte2 & 0x3f) << 12) |
            ((byte3 & 0x3f) << 6) |
            (byte4 & 0x3f);
          result += String.fromCodePoint(codepoint);
        }
      }
      return result;
    }
  },
});

describe("export", () => {
  beforeEach(async () => {
    await render(<Excalidraw />);
  });

  it("export embedded png and reimport", async () => {
    const pngBlob = await API.loadFile("./fixtures/smiley.png");
    const pngBlobEmbedded = await encodePngMetadata({
      blob: pngBlob,
      metadata: serializeAsJSON(testElements, h.state, {}, "local"),
    });
    await API.drop([{ kind: "file", file: pngBlobEmbedded }]);

    await waitFor(() => {
      expect(h.elements).toEqual([
        expect.objectContaining({ type: "text", text: "😀" }),
      ]);
    });
  });

  it("test encoding/decoding scene for SVG export", async () => {
    const metadataElement = document.createElementNS(SVG_NS, "metadata");

    encodeSvgBase64Payload({
      metadataElement,
      payload: serializeAsJSON(testElements, h.state, {}, "local"),
    });

    const decoded = JSON.parse(
      decodeSvgBase64Payload({ svg: metadataElement.innerHTML }),
    );
    expect(decoded.elements).toEqual([
      expect.objectContaining({ type: "text", text: "😀" }),
    ]);
  });

  it("export svg-embedded scene", async () => {
    const svg = await exportToSvg(
      testElements,
      { ...getDefaultAppState(), exportEmbedScene: true },
      {},
    );
    const svgText = svg.outerHTML;

    expect(svgText).toMatchSnapshot(`svg-embdedded scene export output`);
  });

  it("import embedded png (legacy v1)", async () => {
    await API.drop([
      {
        kind: "file",
        file: await API.loadFile("./fixtures/test_embedded_v1.png"),
      },
    ]);
    await waitFor(() => {
      expect(h.elements).toEqual([
        expect.objectContaining({ type: "text", text: "test" }),
      ]);
    });
  });

  it("import embedded png (v2)", async () => {
    await API.drop([
      {
        kind: "file",
        file: await API.loadFile("./fixtures/smiley_embedded_v2.png"),
      },
    ]);
    await waitFor(() => {
      expect(h.elements).toEqual([
        expect.objectContaining({ type: "text", text: "😀" }),
      ]);
    });
  });

  it("import embedded svg (legacy v1)", async () => {
    await API.drop([
      {
        kind: "file",
        file: await API.loadFile("./fixtures/test_embedded_v1.svg"),
      },
    ]);
    await waitFor(() => {
      expect(h.elements).toEqual([
        expect.objectContaining({ type: "text", text: "test" }),
      ]);
    });
  });

  it("import embedded svg (v2)", async () => {
    await API.drop([
      {
        kind: "file",
        file: await API.loadFile("./fixtures/smiley_embedded_v2.svg"),
      },
    ]);
    await waitFor(() => {
      expect(h.elements).toEqual([
        expect.objectContaining({ type: "text", text: "😀" }),
      ]);
    });
  });

  it("exporting svg containing transformed images", async () => {
    const normalizeAngle = (angle: number) => (angle / 180) * Math.PI;

    const elements = [
      API.createElement({
        type: "image",
        fileId: "file_A",
        x: 0,
        y: 0,
        scale: [1, 1],
        width: 100,
        height: 100,
        angle: normalizeAngle(315),
      }),
      API.createElement({
        type: "image",
        fileId: "file_A",
        x: 100,
        y: 0,
        scale: [-1, 1],
        width: 50,
        height: 50,
        angle: normalizeAngle(45),
      }),
      API.createElement({
        type: "image",
        fileId: "file_A",
        x: 0,
        y: 100,
        scale: [1, -1],
        width: 100,
        height: 100,
        angle: normalizeAngle(45),
      }),
      API.createElement({
        type: "image",
        fileId: "file_A",
        x: 100,
        y: 100,
        scale: [-1, -1],
        width: 50,
        height: 50,
        angle: normalizeAngle(315),
      }),
    ];
    const appState = { ...getDefaultAppState(), exportBackground: false };
    const files = {
      file_A: {
        id: "file_A" as FileId,
        dataURL: await getDataURL(await API.loadFile("./fixtures/deer.png")),
        mimeType: "image/png",
        created: Date.now(),
        lastRetrieved: Date.now(),
      },
    } as const;

    const svg = await exportToSvg(elements, appState, files);

    const svgText = svg.outerHTML;

    // expect 1 <image> element (deduped)
    expect(svgText.match(/<image/g)?.length).toBe(1);
    // expect 4 <use> elements (one for each excalidraw image element)
    expect(svgText.match(/<use/g)?.length).toBe(4);

    // in case of regressions, save the SVG to a file and visually compare to:
    // src/tests/fixtures/svg-image-exporting-reference.svg
    expect(svgText).toMatchSnapshot(`svg export output`);
  });

  it("exports scene metadata as an iTXt chunk, not tEXt", async () => {
    const pngBlob = await API.loadFile("./fixtures/smiley.png");
    const pngBlobEmbedded = await encodePngMetadata({
      blob: pngBlob,
      metadata: serializeAsJSON(testElements, h.state, {}, "local"),
    });
    const chunks = decodePng(
      new Uint8Array(await blobToArrayBuffer(pngBlobEmbedded)),
    );
    expect(chunks.some((chunk) => chunk.name === "iTXt")).toBe(true);
    expect(chunks.some((chunk) => chunk.name === "tEXt")).toBe(false);
  });

  it("still imports scenes embedded as a legacy tEXt chunk", async () => {
    const pngBlob = await API.loadFile("./fixtures/smiley.png");
    const chunks = decodePng(new Uint8Array(await blobToArrayBuffer(pngBlob)));
    const legacyChunk = tEXt.encode(
      MIME_TYPES.excalidraw,
      JSON.stringify(
        encode({
          text: serializeAsJSON(testElements, h.state, {}, "local"),
          compress: true,
        }),
      ),
    );
    chunks.splice(-1, 0, legacyChunk);
    const legacyBlob = new Blob([encodePng(chunks)], {
      type: MIME_TYPES.png,
    });

    await API.drop([{ kind: "file", file: legacyBlob }]);

    await waitFor(() => {
      expect(h.elements).toEqual([
        expect.objectContaining({ type: "text", text: "😀" }),
      ]);
    });
  });
});

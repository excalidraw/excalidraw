import React from "react";
import { render, waitFor } from "./test-utils";
import App from "../components/App";
import { API } from "./helpers/api";
import {
  encodePngMetadata,
  encodeSvgMetadata,
  decodeSvgMetadata,
} from "../data/image";
import { serializeAsJSON } from "../data/json";

import fs from "fs";
import util from "util";
import path from "path";

const readFile = util.promisify(fs.readFile);

const { h } = window;

const testElements = [
  {
    ...API.createElement({
      type: "text",
      id: "A",
      text: "😀",
    }),
    // can't get jsdom text measurement to work so this is a temp hack
    //  to ensure the element isn't stripped as invisible
    width: 16,
    height: 16,
  },
];

// tiny polyfill for TextDecoder.decode on which we depend
Object.defineProperty(window, "TextDecoder", {
  value: class TextDecoder {
    decode(ab: ArrayBuffer) {
      return new Uint8Array(ab).reduce(
        (acc, c) => acc + String.fromCharCode(c),
        "",
      );
    }
  },
});

describe("appState", () => {
  beforeEach(() => {
    render(<App />);
  });

  it("export embedded png and reimport", async () => {
    const pngBlob = new Blob(
      [await readFile(path.resolve(__dirname, "./fixtures/smiley.png"))],
      { type: "image/png" },
    );

    const pngBlobEmbedded = await encodePngMetadata({
      blob: pngBlob,
      metadata: serializeAsJSON(testElements, h.state),
    });
    API.dropFile(pngBlobEmbedded);

    await waitFor(() => {
      expect(h.elements).toEqual([
        expect.objectContaining({ type: "text", text: "😀" }),
      ]);
    });
  });

  it("test encoding/decoding scene for SVG export", async () => {
    const encoded = await encodeSvgMetadata({
      text: serializeAsJSON(testElements, h.state),
    });
    const decoded = JSON.parse(await decodeSvgMetadata({ svg: encoded }));
    expect(decoded.elements).toEqual([
      expect.objectContaining({ type: "text", text: "😀" }),
    ]);
  });

  it("import embedded png (legacy v1)", async () => {
    const pngBlob = new Blob(
      [
        await readFile(
          path.resolve(__dirname, "./fixtures/test_embedded_v1.png"),
        ),
      ],
      { type: "image/png" },
    );

    API.dropFile(pngBlob);

    await waitFor(() => {
      expect(h.elements).toEqual([
        expect.objectContaining({ type: "text", text: "test" }),
      ]);
    });
  });

  it("import embedded png (v2)", async () => {
    const pngBlob = new Blob(
      [
        await readFile(
          path.resolve(__dirname, "./fixtures/smiley_embedded_v2.png"),
        ),
      ],
      { type: "image/png" },
    );

    API.dropFile(pngBlob);

    await waitFor(() => {
      expect(h.elements).toEqual([
        expect.objectContaining({ type: "text", text: "😀" }),
      ]);
    });
  });

  it("import embedded svg (legacy v1)", async () => {
    const svgBlob = new Blob(
      [
        await readFile(
          path.resolve(__dirname, "./fixtures/test_embedded_v1.svg"),
        ),
      ],
      { type: "image/svg+xml" },
    );

    API.dropFile(svgBlob);

    await waitFor(() => {
      expect(h.elements).toEqual([
        expect.objectContaining({ type: "text", text: "test" }),
      ]);
    });
  });

  it("import embedded svg (v2)", async () => {
    const svgBlob = new Blob(
      [
        await readFile(
          path.resolve(__dirname, "./fixtures/smiley_embedded_v2.svg"),
        ),
      ],
      { type: "image/svg+xml" },
    );

    API.dropFile(svgBlob);

    await waitFor(() => {
      expect(h.elements).toEqual([
        expect.objectContaining({ type: "text", text: "😀" }),
      ]);
    });
  });
});

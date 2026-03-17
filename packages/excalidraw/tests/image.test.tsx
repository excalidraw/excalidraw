import { EXPORT_DATA_TYPES, randomId, reseed } from "@excalidraw/common";
import tEXt from "png-chunk-text";
import encodePng from "png-chunks-encode";
import decodePng from "png-chunks-extract";

import type { FileId } from "@excalidraw/element/types";

import * as blobModule from "../data/blob";
import * as filesystemModule from "../data/filesystem";
import { decodePngMetadata, encodePngMetadata } from "../data/image";
import { Excalidraw } from "../index";
import { createPasteEvent } from "../clipboard";

import { API } from "./helpers/api";
import { mockMultipleHTMLImageElements } from "./helpers/mocks";
import { UI } from "./helpers/ui";
import { GlobalTestState, render, waitFor } from "./test-utils";
import {
  DEER_IMAGE_DIMENSIONS,
  SMILEY_IMAGE_DIMENSIONS,
} from "./fixtures/constants";
import { INITIALIZED_IMAGE_PROPS } from "./helpers/constants";

const { h } = window;

const createITXtChunk = (keyword: string, text: string) => {
  const keywordBytes = new TextEncoder().encode(keyword);
  const textBytes = new TextEncoder().encode(text);
  const data = new Uint8Array(
    keywordBytes.length + 1 + 1 + 1 + 1 + 1 + textBytes.length,
  );

  let offset = 0;
  data.set(keywordBytes, offset);
  offset += keywordBytes.length;
  data[offset++] = 0;
  data[offset++] = 0;
  data[offset++] = 0;
  data[offset++] = 0;
  data[offset++] = 0;
  data.set(textBytes, offset);

  return { name: "iTXt" as const, data };
};

const insertChunkBeforeFirst = async ({
  blob,
  chunk,
  targetChunkName,
}: {
  blob: Blob;
  chunk: { name: string; data: Uint8Array };
  targetChunkName: string;
}) => {
  const chunks = decodePng(
    new Uint8Array(await blobModule.blobToArrayBuffer(blob)),
  );
  const targetIndex = chunks.findIndex(
    (existingChunk) => existingChunk.name === targetChunkName,
  );

  expect(targetIndex).toBeGreaterThan(-1);

  chunks.splice(targetIndex, 0, chunk);

  return new Blob([encodePng(chunks)], { type: "image/png" });
};

export const setupImageTest = async (
  sizes: { width: number; height: number }[],
) => {
  await render(<Excalidraw autoFocus={true} handleKeyboardGlobally={true} />);

  h.state.height = 1000;

  mockMultipleHTMLImageElements(sizes.map((size) => [size.width, size.height]));
};

describe("image insertion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();

    reseed(7);

    const generateIdSpy = vi.spyOn(blobModule, "generateIdFromFile");
    const resizeFileSpy = vi.spyOn(blobModule, "resizeImageFile");

    generateIdSpy.mockImplementation(() =>
      Promise.resolve(randomId() as FileId),
    );
    resizeFileSpy.mockImplementation((file: File) => Promise.resolve(file));

    Object.assign(document, {
      elementFromPoint: () => GlobalTestState.canvas,
    });
  });

  const setup = () =>
    setupImageTest([DEER_IMAGE_DIMENSIONS, SMILEY_IMAGE_DIMENSIONS]);

  const assert = async () => {
    await waitFor(() => {
      expect(h.elements).toEqual([
        expect.objectContaining({
          ...INITIALIZED_IMAGE_PROPS,
          ...DEER_IMAGE_DIMENSIONS,
        }),
        expect.objectContaining({
          ...INITIALIZED_IMAGE_PROPS,
          ...SMILEY_IMAGE_DIMENSIONS,
        }),
      ]);
    });
    // Not placed on top of each other
    const dimensionsSet = new Set(h.elements.map((el) => `${el.x}-${el.y}`));
    expect(dimensionsSet.size).toEqual(h.elements.length);
  };

  it("should eventually initialize all dropped images", async () => {
    await setup();

    const files = await Promise.all([
      API.loadFile("./fixtures/deer.png"),
      API.loadFile("./fixtures/smiley.png"),
    ]);
    await API.drop(files.map((file) => ({ kind: "file", file })));

    await assert();
  });

  it("should eventually initialize all pasted images", async () => {
    await setup();

    document.dispatchEvent(
      createPasteEvent({
        files: await Promise.all([
          API.loadFile("./fixtures/deer.png"),
          API.loadFile("./fixtures/smiley.png"),
        ]),
      }),
    );

    await assert();
  });

  it("should eventually initialize all images added through image tool", async () => {
    await setup();

    const fileOpenSpy = vi.spyOn(filesystemModule, "fileOpen");
    fileOpenSpy.mockImplementation(
      async () =>
        await Promise.all([
          API.loadFile("./fixtures/deer.png"),
          API.loadFile("./fixtures/smiley.png"),
        ]),
    );
    UI.clickTool("image");

    await assert();
  });
});

describe("png metadata", () => {
  it("stores scene metadata in iTXt chunks", async () => {
    const pngBlob = await API.loadFile("./fixtures/smiley.png");
    const metadata = JSON.stringify({
      type: EXPORT_DATA_TYPES.excalidraw,
      elements: [{ type: "text", text: "😀" }],
    });

    const embedded = await encodePngMetadata({
      blob: pngBlob,
      metadata,
    });

    const chunks = decodePng(
      new Uint8Array(await blobModule.blobToArrayBuffer(embedded)),
    );

    expect(chunks.some((chunk) => chunk.name === "iTXt")).toBe(true);
  });

  it("roundtrips iTXt metadata content", async () => {
    const pngBlob = await API.loadFile("./fixtures/smiley.png");
    const metadata = JSON.stringify({
      type: EXPORT_DATA_TYPES.excalidraw,
      elements: [{ type: "text", text: "😀" }],
    });

    const embedded = await encodePngMetadata({
      blob: pngBlob,
      metadata,
    });

    await expect(decodePngMetadata(embedded)).resolves.toBe(metadata);
  });

  it("keeps legacy tEXt decoding support", async () => {
    const legacyBlob = await API.loadFile("./fixtures/smiley_embedded_v2.png");
    const metadata = await decodePngMetadata(legacyBlob);

    expect(JSON.parse(metadata).elements).toEqual([
      expect.objectContaining({ type: "text", text: "😀" }),
    ]);
  });

  it("ignores unrelated iTXt chunks before the excalidraw metadata", async () => {
    const pngBlob = await API.loadFile("./fixtures/smiley.png");
    const metadata = JSON.stringify({
      type: EXPORT_DATA_TYPES.excalidraw,
      elements: [{ type: "text", text: "😀" }],
    });

    const embedded = await encodePngMetadata({
      blob: pngBlob,
      metadata,
    });

    const withUnrelatedITXt = await insertChunkBeforeFirst({
      blob: embedded,
      chunk: createITXtChunk("Comment", "preview metadata"),
      targetChunkName: "iTXt",
    });

    await expect(decodePngMetadata(withUnrelatedITXt)).resolves.toBe(metadata);
  });

  it("ignores unrelated tEXt chunks before the excalidraw metadata", async () => {
    const legacyBlob = await API.loadFile("./fixtures/smiley_embedded_v2.png");

    const withUnrelatedTEXt = await insertChunkBeforeFirst({
      blob: legacyBlob,
      chunk: tEXt.encode("Comment", "preview metadata"),
      targetChunkName: "tEXt",
    });

    const metadata = await decodePngMetadata(withUnrelatedTEXt);

    expect(JSON.parse(metadata).elements).toEqual([
      expect.objectContaining({ type: "text", text: "😀" }),
    ]);
  });
});

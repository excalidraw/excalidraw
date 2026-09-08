import tEXt from "png-chunk-text";
import encodePng from "png-chunks-encode";
import decodePng from "png-chunks-extract";

import { EXPORT_DATA_TYPES, MIME_TYPES } from "@excalidraw/common";

import { blobToArrayBuffer } from "./blob";
import { encode, decode } from "./encode";

// -----------------------------------------------------------------------------
// PNG
// -----------------------------------------------------------------------------

// tEXt chunks only support Latin-1, but we encode scene metadata as UTF-8
// (see https://github.com/excalidraw/excalidraw/issues/9269), which other PNG
// decoders may reject or mangle even though browsers tolerate it. iTXt
// (https://www.w3.org/TR/png/#11iTXt) is the PNG spec's UTF-8-safe text chunk,
// so we write metadata as iTXt going forward. We still read tEXt so PNGs
// exported by older excalidraw versions keep working.
const iTXt = {
  encode: (keyword: string, text: string): PngChunk => {
    const keywordBytes = new TextEncoder().encode(keyword);
    const textBytes = new TextEncoder().encode(text);
    const data = new Uint8Array(
      keywordBytes.length +
        1 + // null separator after keyword
        1 + // compression flag
        1 + // compression method
        1 + // null separator after (empty) language tag
        1 + // null separator after (empty) translated keyword
        textBytes.length,
    );
    let offset = 0;
    data.set(keywordBytes, offset);
    offset += keywordBytes.length;
    data[offset++] = 0; // null separator after keyword
    data[offset++] = 0; // compression flag: uncompressed
    data[offset++] = 0; // compression method (only 0 is valid)
    data[offset++] = 0; // empty language tag + its null separator
    data[offset++] = 0; // empty translated keyword + its null separator
    data.set(textBytes, offset);
    return { name: "iTXt", data };
  },
  decode: (data: Uint8Array): { keyword: string; text: string } => {
    let offset = data.indexOf(0);
    const keyword = new TextDecoder("latin1").decode(data.subarray(0, offset));
    offset += 1; // skip null separator
    const compressionFlag = data[offset];
    offset += 2; // skip compression flag + compression method
    offset = data.indexOf(0, offset) + 1; // skip language tag
    offset = data.indexOf(0, offset) + 1; // skip translated keyword
    if (compressionFlag === 1) {
      throw new Error("Compressed iTXt chunks are not supported");
    }
    const text = new TextDecoder("utf-8").decode(data.subarray(offset));
    return { keyword, text };
  },
};

export const getTEXtChunk = async (
  blob: Blob,
): Promise<{ keyword: string; text: string } | null> => {
  const chunks = decodePng(new Uint8Array(await blobToArrayBuffer(blob)));
  const iTXtChunk = chunks.find((chunk) => chunk.name === "iTXt");
  if (iTXtChunk) {
    return iTXt.decode(iTXtChunk.data);
  }
  const metadataChunk = chunks.find((chunk) => chunk.name === "tEXt");
  if (metadataChunk) {
    return tEXt.decode(metadataChunk.data);
  }
  return null;
};

export const encodePngMetadata = async ({
  blob,
  metadata,
}: {
  blob: Blob;
  metadata: string;
}) => {
  const chunks = decodePng(new Uint8Array(await blobToArrayBuffer(blob)));

  const metadataChunk = iTXt.encode(
    MIME_TYPES.excalidraw,
    JSON.stringify(
      encode({
        text: metadata,
        compress: true,
      }),
    ),
  );
  // insert metadata before last chunk (iEND)
  chunks.splice(-1, 0, metadataChunk);

  return new Blob([encodePng(chunks)], { type: MIME_TYPES.png });
};

export const decodePngMetadata = async (blob: Blob) => {
  const metadata = await getTEXtChunk(blob);
  if (metadata?.keyword === MIME_TYPES.excalidraw) {
    try {
      const encodedData = JSON.parse(metadata.text);
      if (!("encoded" in encodedData)) {
        // legacy, un-encoded scene JSON
        if (
          "type" in encodedData &&
          encodedData.type === EXPORT_DATA_TYPES.excalidraw
        ) {
          return metadata.text;
        }
        throw new Error("FAILED");
      }
      return decode(encodedData);
    } catch (error: any) {
      console.error(error);
      throw new Error("FAILED");
    }
  }
  throw new Error("INVALID");
};

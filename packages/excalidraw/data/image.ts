import tEXt from "png-chunk-text";
import encodePng from "png-chunks-encode";
import decodePng from "png-chunks-extract";

import { EXPORT_DATA_TYPES, MIME_TYPES } from "@excalidraw/common";

import { blobToArrayBuffer } from "./blob";
import { encode, decode } from "./encode";

// -----------------------------------------------------------------------------
// PNG
// -----------------------------------------------------------------------------

export const getTEXtChunk = async (
  blob: Blob,
): Promise<{ keyword: string; text: string } | null> => {
  const chunks = decodePng(new Uint8Array(await blobToArrayBuffer(blob)));
  const metadataChunk = chunks.find((chunk) => chunk.name === "tEXt");
  if (metadataChunk) {
    return tEXt.decode(metadataChunk.data);
  }
  return null;
};

/** a PNG chunk = 4B length + 4B chunk type + data + 4B CRC */
const PNG_CHUNK_OVERHEAD_BYTES = 12;

const createPngMetadataChunk = (metadata: string) =>
  tEXt.encode(
    MIME_TYPES.excalidraw,
    JSON.stringify(
      encode({
        text: metadata,
        compress: true,
      }),
    ),
  );

/**
 * Number of bytes that embedding the scene `metadata` adds to an exported PNG
 * (see `encodePngMetadata`), without having to render the PNG itself.
 */
export const getPngMetadataSize = (metadata: string) =>
  createPngMetadataChunk(metadata).data.length + PNG_CHUNK_OVERHEAD_BYTES;

export const encodePngMetadata = async ({
  blob,
  metadata,
}: {
  blob: Blob;
  metadata: string;
}) => {
  const chunks = decodePng(new Uint8Array(await blobToArrayBuffer(blob)));

  const metadataChunk = createPngMetadataChunk(metadata);
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

/**
 * Formats a byte count in a short human readable form, e.g. `850 B`,
 * `2.4 kB`, `22 kB` or `1.3 MB` (SI units, as used by browsers & OSes).
 */
export const formatFileSize = (bytes: number) => {
  if (bytes < 1000) {
    return `${bytes} B`;
  }
  const [value, unit] =
    bytes < 1000 * 1000 ? [bytes / 1000, "kB"] : [bytes / 1000 / 1000, "MB"];
  // keep one decimal place for small values only (2.4 kB, but 22 kB)
  const rounded = value < 10 ? Math.round(value * 10) / 10 : Math.round(value);
  return `${rounded} ${unit}`;
};

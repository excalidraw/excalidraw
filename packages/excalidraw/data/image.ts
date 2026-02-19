import { inflate } from "pako";
import tEXt from "png-chunk-text";
import encodePng from "png-chunks-encode";
import decodePng from "png-chunks-extract";

import { EXPORT_DATA_TYPES, MIME_TYPES } from "@excalidraw/common";

import { blobToArrayBuffer } from "./blob";
import { encode, decode } from "./encode";

type PNGMetadataChunk = {
  keyword: string;
  text: string;
};

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

const readNullTerminatedText = (data: Uint8Array, offset: number) => {
  const index = data.indexOf(0, offset);
  if (index < 0) {
    throw new Error("INVALID");
  }
  return {
    value: textDecoder.decode(data.slice(offset, index)),
    nextOffset: index + 1,
  };
};

const decodeITXtChunk = (data: Uint8Array): PNGMetadataChunk => {
  let offset = 0;

  const keywordSection = readNullTerminatedText(data, offset);
  offset = keywordSection.nextOffset;

  const compressionFlag = data[offset++];
  const compressionMethod = data[offset++];

  if (compressionFlag !== 0 && compressionFlag !== 1) {
    throw new Error("INVALID");
  }
  if (compressionFlag === 1 && compressionMethod !== 0) {
    throw new Error("INVALID");
  }

  const languageSection = readNullTerminatedText(data, offset);
  offset = languageSection.nextOffset;

  const translatedKeywordSection = readNullTerminatedText(data, offset);
  offset = translatedKeywordSection.nextOffset;

  const textSection = data.slice(offset);
  const decodedTextSection =
    compressionFlag === 1 ? inflate(textSection) : textSection;
  const textBytes =
    decodedTextSection instanceof Uint8Array
      ? decodedTextSection
      : new Uint8Array(decodedTextSection);

  return {
    keyword: keywordSection.value,
    text: textDecoder.decode(textBytes),
  };
};

const encodeITXtChunk = ({ keyword, text }: PNGMetadataChunk): ITXtChunk => {
  const keywordBytes = textEncoder.encode(keyword);
  const textBytes = textEncoder.encode(text);
  // [keyword]\0[compression flag][compression method]\0\0[text]
  const data = new Uint8Array(
    keywordBytes.length + 1 + 1 + 1 + 1 + 1 + textBytes.length,
  );
  let offset = 0;

  data.set(keywordBytes, offset);
  offset += keywordBytes.length;
  data[offset++] = 0;
  // Store metadata uncompressed (already compressed by encode()).
  data[offset++] = 0;
  data[offset++] = 0;
  // Empty languageTag + translatedKeyword.
  data[offset++] = 0;
  data[offset++] = 0;
  data.set(textBytes, offset);

  return {
    name: "iTXt",
    data,
  };
};

// -----------------------------------------------------------------------------
// PNG
// -----------------------------------------------------------------------------

export const getTEXtChunk = async (
  blob: Blob,
): Promise<PNGMetadataChunk | null> => {
  const chunks = decodePng(new Uint8Array(await blobToArrayBuffer(blob)));

  const iTXtMetadataChunk = chunks.find((chunk) => chunk.name === "iTXt");
  if (iTXtMetadataChunk) {
    try {
      const decoded = decodeITXtChunk(iTXtMetadataChunk.data);
      return { keyword: decoded.keyword, text: decoded.text };
    } catch {
      // Fall back to legacy tEXt chunks.
    }
  }

  const tEXtMetadataChunk = chunks.find((chunk) => chunk.name === "tEXt");
  if (tEXtMetadataChunk) {
    return tEXt.decode(tEXtMetadataChunk.data);
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

  const metadataChunk = encodeITXtChunk({
    keyword: MIME_TYPES.excalidraw,
    text: JSON.stringify(
      encode({
        text: metadata,
        compress: true,
      }),
    ),
  });
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

import tEXt from "png-chunk-text";
import { encode as encodeITXt, decode as decodeITXt } from "png-chunk-itxt";
import encodePng from "png-chunks-encode";
import decodePng from "png-chunks-extract";

import { EXPORT_DATA_TYPES, MIME_TYPES } from "@excalidraw/common";

import { blobToArrayBuffer } from "./blob";
import { encode, decode } from "./encode";

// -----------------------------------------------------------------------------
// PNG
// -----------------------------------------------------------------------------

export const getMetadataChunk = async (
  blob: Blob,
): Promise<{ 
    keyword: string; 
    text: string;
    compressionFlag?: boolean;
    compressionMethod?: number;
    languageTag?: string;
    translatedKeyword?: string;
  } | null> => {
  const chunks = decodePng(new Uint8Array(await blobToArrayBuffer(blob)));
  
  const iTXtChunk = chunks.find((chunk) => chunk.name === "iTXt");

  if (iTXtChunk) {
    try {
      const decoded = decodeITXt(iTXtChunk.data);
      console.log("Decoded iTXt chunk:", decoded);
      return { 
        keyword: decoded.keyword, 
        text: decoded.text,
        compressionFlag: decoded.compressed,
        compressionMethod: decoded.compressedMethod,
        languageTag: decoded.language || "",
        translatedKeyword: decoded.translated || ""
      };
    } catch (error) {
      console.error("Failed to decode iTXt chunk:", error);
    }
  }
  
  const tEXtChunk = chunks.find((chunk) => chunk.name === "tEXt");
  if (tEXtChunk) {
    return tEXt.decode(tEXtChunk.data);
  }
  
  return null;
};

export const encodePngMetadata = async ({
  blob,
  metadata,
  useITXt = true,
}: {
  blob: Blob;
  metadata: string;
  useITXt?: boolean;
}) => {
  const chunks = decodePng(new Uint8Array(await blobToArrayBuffer(blob)));
  debugger;
  const filteredChunks = chunks.filter(
    (chunk) => 
      !(chunk.name === "tEXt" && 
        tEXt.decode(chunk.data).keyword === MIME_TYPES.excalidraw) &&
      !(chunk.name === "iTXt" && 
        decodeITXt(chunk.data).keyword === MIME_TYPES.excalidraw)
  );
  
  const encodedData = JSON.stringify(
    encode({
      text: metadata,
      compress: true,
    }),
  );

  let metadataChunk;
  try {
    if (useITXt) {
      metadataChunk = encodeITXt(
        MIME_TYPES.excalidraw,
        encodedData,
        { 
          compressed: true,
          compressedMethod: 0,
          language: "en",
          translated: ""
        }
      );
    } else {
      throw new Error("Fallback to tEXt");
    }
  } catch (error) {
    console.warn("iTXt encoding failed, falling back to tEXt:", error);
    metadataChunk = tEXt.encode(
      MIME_TYPES.excalidraw,
      encodedData,
    );
  }
  
  filteredChunks.splice(-1, 0, metadataChunk);

  return new Blob([encodePng(filteredChunks)], { type: MIME_TYPES.png });
};

export const decodePngMetadata = async (blob: Blob) => {
  const metadata = await getMetadataChunk(blob);
  if (metadata?.keyword === MIME_TYPES.excalidraw) {
    try {
      const encodedData = JSON.parse(metadata.text);
      if (!("encoded" in encodedData)) {
        if (
          "type" in encodedData &&
          encodedData.type === EXPORT_DATA_TYPES.excalidraw
        ) {
          return metadata.text;
        }
        throw new Error("Malformed or unexpected metadata format");
      }
      return decode(encodedData);
    } catch (error: any) {
      console.error(error);
      throw new Error("Malformed or unexpected metadata format");
    }
  }
  throw new Error("Invalid or unsupported PNG metadata format");
};

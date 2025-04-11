import tEXt from "png-chunk-text";
import encodePng from "png-chunks-encode";
import decodePng from "png-chunks-extract";

import { EXPORT_DATA_TYPES, MIME_TYPES } from "@excalidraw/common";

import { blobToArrayBuffer } from "./blob";
import { encode, decode, encodeITXtChunk, decodeITXtChunk } from "./encode";

type TEXtChunk = { name: "tEXt"; data: Uint8Array };
type ITXtChunk = { name: "iTXt"; data: Uint8Array };
type PngChunk = TEXtChunk | ITXtChunk;

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
  try {
    const chunks = decodePng(new Uint8Array(await blobToArrayBuffer(blob))) as PngChunk[];
    
    // Try iTXt chunk first (preferred format)
    const iTXtChunk = chunks.find((chunk) => chunk.name === "iTXt");
    if (iTXtChunk) {
      try {
        const decoded = decodeITXtChunk(iTXtChunk.data);
        console.debug("Decoded iTXt chunk:", decoded);
        return { 
          keyword: decoded.keyword, 
          text: decoded.text,
          compressionFlag: decoded.compressed,
          compressionMethod: decoded.compressedMethod,
          languageTag: decoded.language,
          translatedKeyword: decoded.translated
        };
      } catch (error) {
        console.warn("Failed to decode iTXt chunk:", error);
      }
    }
    
    // Fallback to tEXt chunk
    const tEXtChunk = chunks.find((chunk) => chunk.name === "tEXt");
    if (tEXtChunk) {
      try {
        return tEXt.decode(tEXtChunk.data);
      } catch (error) {
        console.warn("Failed to decode tEXt chunk:", error);
      }
    }
    
    return null;
  } catch (error) {
    console.error("Failed to get metadata chunk:", error);
    return null;
  }
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
  try {
    const chunks = decodePng(new Uint8Array(await blobToArrayBuffer(blob))) as PngChunk[];

    const filteredChunks = chunks.filter((chunk) => {
      try {
        if (chunk.name === "tEXt") {
          return tEXt.decode(chunk.data).keyword !== MIME_TYPES.excalidraw;
        }
        if (chunk.name === "iTXt") {
          return decodeITXtChunk(chunk.data).keyword !== MIME_TYPES.excalidraw;
        }
        return true;
      } catch (error) {
        console.warn("Failed to decode chunk during filtering:", error);
        return true;
      }
    });
    
    const encodedData = JSON.stringify(
      encode({
        text: metadata,
        compress: true,
      }),
    );

    let metadataChunk: PngChunk;
    try {
      if (useITXt) {
        metadataChunk = {
          name: "iTXt",
          data: encodeITXtChunk({
            keyword: MIME_TYPES.excalidraw,
            text: encodedData,
            compressionFlag: true,
            compressionMethod: 0,
            languageTag: "en",
            translatedKeyword: ""
          })
        };
      } else {
        throw new Error("Fallback to tEXt");
      }
    } catch (error) {
      console.warn("iTXt encoding failed, falling back to tEXt:", error);
      const tEXtData = tEXt.encode(
        MIME_TYPES.excalidraw,
        encodedData,
      ) as unknown as Uint8Array;
      metadataChunk = {
        name: "tEXt",
        data: tEXtData
      };
    }
    
    // Insert metadata chunk before the IEND chunk (last chunk)
    filteredChunks.splice(-1, 0, metadataChunk);

    return new Blob(
      [(encodePng as (chunks: PngChunk[]) => Uint8Array)(filteredChunks)], 
      { type: MIME_TYPES.png }
    );
  } catch (error) {
    console.error("Failed to encode PNG metadata:", error);
    throw new Error("Failed to encode PNG metadata");
  }
};

export const decodePngMetadata = async (blob: Blob) => {
  try {
    const metadata = await getMetadataChunk(blob);
    
    if (!metadata?.keyword || metadata.keyword !== MIME_TYPES.excalidraw) {
      throw new Error("Invalid or unsupported PNG metadata format");
    }

    try {
      const encodedData = JSON.parse(metadata.text);
      
      // Handle legacy format
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
    } catch (error) {
      console.error("Failed to decode metadata:", error);
      throw new Error("Malformed or unexpected metadata format");
    }
  } catch (error) {
    console.error("Failed to decode PNG metadata:", error);
    throw new Error("Failed to decode PNG metadata");
  }
};

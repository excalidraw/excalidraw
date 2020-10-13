import decodePng from "png-chunks-extract";
import tEXt from "png-chunk-text";
import encodePng from "png-chunks-encode";

const blobToArrayBuffer = (blob: Blob): Promise<ArrayBuffer> => {
  if ("arrayBuffer" in blob) {
    return blob.arrayBuffer();
  }
  // Safari
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      if (!event.target?.result) {
        return reject(new Error("couldn't convert blob to ArrayBuffer"));
      }
      resolve(event.target.result as ArrayBuffer);
    };
    reader.readAsArrayBuffer(blob);
  });
};

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

export const encodeTEXtChunk = async (
  blob: Blob,
  chunk: { keyword: string; text: string },
): Promise<Blob> => {
  const chunks = decodePng(new Uint8Array(await blobToArrayBuffer(blob)));
  const metadata = tEXt.encode(chunk.keyword, chunk.text);
  // insert metadata before last chunk (iEND)
  chunks.splice(-1, 0, metadata);
  return new Blob([encodePng(chunks)], { type: "image/png" });
};

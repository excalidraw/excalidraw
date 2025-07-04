import { deflate, inflate } from "pako";

// -----------------------------------------------------------------------------
// byte (binary) strings
// -----------------------------------------------------------------------------

// Buffer-compatible implem.
//
// Note that in V8, spreading the uint8array (by chunks) into
// `String.fromCharCode(...uint8array)` tends to be faster for large
// strings/buffers, in case perf is needed in the future.
export const toByteString = (data: string | Uint8Array | ArrayBuffer) => {
  const bytes =
    typeof data === "string"
      ? new TextEncoder().encode(data)
      : data instanceof Uint8Array
      ? data
      : new Uint8Array(data);
  let bstring = "";
  for (const byte of bytes) {
    bstring += String.fromCharCode(byte);
  }
  return bstring;
};

const byteStringToArrayBuffer = (byteString: string) => {
  const buffer = new ArrayBuffer(byteString.length);
  const bufferView = new Uint8Array(buffer);
  for (let i = 0, len = byteString.length; i < len; i++) {
    bufferView[i] = byteString.charCodeAt(i);
  }
  return buffer;
};

const byteStringToString = (byteString: string) => {
  return new TextDecoder("utf-8").decode(byteStringToArrayBuffer(byteString));
};

// -----------------------------------------------------------------------------
// base64
// -----------------------------------------------------------------------------

/**
 * @param isByteString set to true if already byte string to prevent bloat
 *  due to reencoding
 */
export const stringToBase64 = (str: string, isByteString = false) => {
  return isByteString ? window.btoa(str) : window.btoa(toByteString(str));
};

// async to align with stringToBase64
export const base64ToString = (base64: string, isByteString = false) => {
  return isByteString
    ? window.atob(base64)
    : byteStringToString(window.atob(base64));
};

export const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
  if (typeof Buffer !== "undefined") {
    // Node.js environment
    return Buffer.from(base64, "base64").buffer;
  }
  // Browser environment
  return byteStringToArrayBuffer(atob(base64));
};

// -----------------------------------------------------------------------------
// text encoding
// -----------------------------------------------------------------------------

type EncodedData = {
  encoded: string;
  encoding: "bstring";
  /** whether text is compressed (zlib) */
  compressed: boolean;
  /** version for potential migration purposes */
  version?: string;
};

/**
 * Encodes (and potentially compresses via zlib) text to byte string
 */
export const encode = ({
  text,
  compress,
}: {
  text: string;
  /** defaults to `true`. If compression fails, falls back to bstring alone. */
  compress?: boolean;
}): EncodedData => {
  let deflated!: string;
  if (compress !== false) {
    try {
      deflated = toByteString(deflate(text));
    } catch (error: any) {
      console.error("encode: cannot deflate", error);
    }
  }
  return {
    version: "1",
    encoding: "bstring",
    compressed: !!deflated,
    encoded: deflated || toByteString(text),
  };
};

export const decode = (data: EncodedData): string => {
  let decoded: string;

  switch (data.encoding) {
    case "bstring":
      // if compressed, do not double decode the bstring
      decoded = data.compressed
        ? data.encoded
        : byteStringToString(data.encoded);
      break;
    default:
      throw new Error(`decode: unknown encoding "${data.encoding}"`);
  }

  if (data.compressed) {
    return inflate(new Uint8Array(byteStringToArrayBuffer(decoded)), {
      to: "string",
    });
  }

  return decoded;
};

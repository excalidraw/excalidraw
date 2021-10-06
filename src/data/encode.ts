import { deflate, inflate } from "pako";
import { encryptData, decryptData } from "./encryption";

// -----------------------------------------------------------------------------
// byte (binary) strings
// -----------------------------------------------------------------------------

// fast, Buffer-compatible implem
export const toByteString = (
  data: string | Uint8Array | ArrayBuffer,
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const blob =
      typeof data === "string"
        ? new Blob([new TextEncoder().encode(data)])
        : new Blob([data instanceof Uint8Array ? data : new Uint8Array(data)]);
    const reader = new FileReader();
    reader.onload = (event) => {
      if (!event.target || typeof event.target.result !== "string") {
        return reject(new Error("couldn't convert to byte string"));
      }
      resolve(event.target.result);
    };
    reader.readAsBinaryString(blob);
  });
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
export const stringToBase64 = async (str: string, isByteString = false) => {
  return isByteString ? btoa(str) : btoa(await toByteString(str));
};

export const toBase64 = async (data: string | Uint8Array | ArrayBuffer) => {
  return btoa(await toByteString(data));
};

// async to align with stringToBase64
export const base64ToString = async (base64: string, isByteString = false) => {
  return isByteString ? atob(base64) : byteStringToString(atob(base64));
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
export const encode = async ({
  text,
  compress,
}: {
  text: string;
  /** defaults to `true`. If compression fails, falls back to bstring alone. */
  compress?: boolean;
}): Promise<EncodedData> => {
  let deflated!: string;
  if (compress !== false) {
    try {
      deflated = await toByteString(deflate(text));
    } catch (error) {
      console.error("encode: cannot deflate", error);
    }
  }
  return {
    version: "1",
    encoding: "bstring",
    compressed: !!deflated,
    encoded: deflated || (await toByteString(text)),
  };
};

export const decode = async (data: EncodedData): Promise<string> => {
  let decoded: string;

  switch (data.encoding) {
    case "bstring":
      // if compressed, do not double decode the bstring
      decoded = data.compressed
        ? data.encoded
        : await byteStringToString(data.encoded);
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

// -----------------------------------------------------------------------------
// binary encoding
// -----------------------------------------------------------------------------

type FileEncodingInfo = {
  version: 1;
  compression: "pako@1";
  encryption: "AES-GCM" | null;
};

// -----------------------------------------------------------------------------
/** how many bytes we use to encode how many bytes the next chunk has.
 * Corresponds to DataView setter methods (setUint32, setUint16, etc).
 *
 * NOTE ! values must not be changed, which would be backwards incompatible !
 */
const NEXT_CHUNK_SIZE_DATAVIEW_BYTES = 4;
const CHUNKS_COUNT_DATAVIEW_BYTES = 2;
// -----------------------------------------------------------------------------

// getter
function dataView(buffer: Uint8Array, bytes: 1 | 2 | 4, offset: number): number;
// setter
function dataView(
  buffer: Uint8Array,
  bytes: 1 | 2 | 4,
  offset: number,
  value: number,
): Uint8Array;
/**
 * abstraction over DataView that serves as a typed getter/setter in case
 * you're using constants for the byte size and want to ensure there's no
 * discrepenancy in the encoding across refactors.
 *
 * DataView serves for an endian-agnostic handling of numbers in ArrayBuffers.
 */
function dataView(
  buffer: Uint8Array,
  bytes: 1 | 2 | 4,
  offset: number,
  value?: number,
): Uint8Array | number {
  const bits = { 1: 8, 2: 16, 4: 32 } as const;
  if (value != null) {
    if (value > Math.pow(2, bits[bytes]) - 1) {
      throw new Error(
        `attempting to set value higher than the allocated bytes (value: ${value}, bytes: ${bytes})`,
      );
    }
    const method = `setUint${bits[bytes]}` as const;
    new DataView(buffer.buffer)[method](offset, value);
    return buffer;
  }
  const method = `getUint${bits[bytes]}` as const;
  return new DataView(buffer.buffer)[method](offset);
}

// -----------------------------------------------------------------------------

/**
 * Resulting concatenated buffer has this format:
 *
 * [
 *   COUNT chunk (number of DATA chunks — i.e. excludes this and LENGTH chunks)
 *   LENGTH chunk 1 (4 bytes)
 *   DATA chunk 1 (up to by 2^32 bytes)
 *   LENGTH chunk 2 (4 bytes)
 *   DATA chunk 2 (up to by 2^32 bytes)
 *   ...
 *   LENGTH chunk N-1 (4 bytes)
 *   DATA chunk N-1 (up to by 2^32 bytes)
 *   DATA chunk N (any size)
 * ]
 *
 * The last chunk doesn't need to have a length header because the COUNT chunk
 * tells us whether we're reading the last chunk or not.
 *
 * @param buffers each buffer (chunk) must be at most 2^32 bytes large (~4MB),
 * except the last chunk which can be of any size
 */
const concatBuffers = (...buffers: Uint8Array[]) => {
  const bufferView = new Uint8Array(
    CHUNKS_COUNT_DATAVIEW_BYTES +
      NEXT_CHUNK_SIZE_DATAVIEW_BYTES * Math.max(buffers.length - 1, 1) +
      buffers.reduce((acc, buffer) => acc + buffer.byteLength, 0),
  );

  let cursor = 0;

  // as the first chunk we'll encode how many chunks will follow
  dataView(bufferView, CHUNKS_COUNT_DATAVIEW_BYTES, cursor, buffers.length);
  cursor += CHUNKS_COUNT_DATAVIEW_BYTES;

  let i = 0;
  for (const buffer of buffers) {
    i++;
    if (i < buffers.length) {
      dataView(
        bufferView,
        NEXT_CHUNK_SIZE_DATAVIEW_BYTES,
        cursor,
        buffer.byteLength,
      );
      cursor += NEXT_CHUNK_SIZE_DATAVIEW_BYTES;
    }

    bufferView.set(buffer, cursor);
    cursor += buffer.byteLength;
  }

  return bufferView;
};

/** can only be used on buffers created via `concatBuffers()` */
const splitBuffers = (concatenatedBuffer: Uint8Array) => {
  const buffers = [];

  let cursor = 0;

  // first chunk tells us how many other chunks there are
  const chunkCount = dataView(
    concatenatedBuffer,
    CHUNKS_COUNT_DATAVIEW_BYTES,
    cursor,
  );
  cursor += CHUNKS_COUNT_DATAVIEW_BYTES;

  let i = 0;
  while (true) {
    i++;
    if (i < chunkCount) {
      const chunkSize = dataView(
        concatenatedBuffer,
        NEXT_CHUNK_SIZE_DATAVIEW_BYTES,
        cursor,
      );
      cursor += NEXT_CHUNK_SIZE_DATAVIEW_BYTES;

      buffers.push(concatenatedBuffer.slice(cursor, cursor + chunkSize));
      cursor += chunkSize;
      if (cursor >= concatenatedBuffer.byteLength) {
        break;
      }
    } else {
      buffers.push(concatenatedBuffer.slice(cursor));
      break;
    }
  }

  return buffers;
};

/** @private */
const _compress = async <K extends string>(
  data: Uint8Array | string,
  encryptionKey?: K,
): Promise<Uint8Array> => {
  const deflated = new Uint8Array(deflate(data));
  if (encryptionKey) {
    const { encryptedBuffer, iv } = await encryptData(encryptionKey, deflated);

    return concatBuffers(iv, new Uint8Array(encryptedBuffer));
  }
  return deflated;
};

// Format of the returned Uint8Array buffer.
// `[]` represents a buffer chunk. Some chunks are nested.
//
// [
//   /* encodingMetadata */ [ data ]
//   /* contentsMetadata */ [ [iv] [data] ]
//   /* contents */         [ [iv] [data] ]
// ]
export const compressData = async <T extends Record<string, any> = never>(
  data: Uint8Array,
  options?: {
    /** if supplied, the data will be encrypted using (otherwise no
     *  encryption will take place) */
    encryptionKey?: string;
  } & ([T] extends [never]
    ? {
        metadata?: T;
      }
    : {
        metadata: T;
      }),
): Promise<Uint8Array> => {
  const fileInfo: FileEncodingInfo = {
    version: 1,
    compression: "pako@1",
    encryption: options?.encryptionKey ? "AES-GCM" : null,
  };

  const encodingMetadataBuffer = new TextEncoder().encode(
    JSON.stringify(fileInfo),
  );

  const contentsMetadataBuffer = await _compress(
    JSON.stringify(options?.metadata || null),
    options?.encryptionKey,
  );

  const contentsBuffer = await _compress(data, options?.encryptionKey);

  return concatBuffers(
    encodingMetadataBuffer,
    contentsMetadataBuffer,
    contentsBuffer,
  );
};

/** @private */
const _decompress = async (bufferView: Uint8Array, decryptionKey?: string) => {
  if (decryptionKey) {
    const [iv, encryptedBuffer] = splitBuffers(bufferView);
    bufferView = new Uint8Array(
      await decryptData(
        // the iv was deserialized to array so we need convert it to typed array
        iv,
        encryptedBuffer,
        decryptionKey,
      ),
    );
  }

  return inflate(bufferView);
};

export const decompressData = async <T extends Record<string, any>>(
  bufferView: Uint8Array,
  options?: { decryptionKey: string },
) => {
  let [
    encodingMetadataBuffer,
    contentsMetadataBuffer,
    contentsBuffer,
  ] = splitBuffers(bufferView);

  const encodingMetadata: FileEncodingInfo = JSON.parse(
    new TextDecoder().decode(encodingMetadataBuffer),
  );

  if (options?.decryptionKey && !encodingMetadata.encryption) {
    throw new Error(
      "`options.decryptionKey` was supplied but the data is not encrypted.",
    );
  }
  if (encodingMetadata.encryption && !options?.decryptionKey) {
    throw new Error(
      "The data is encrypted but `options.decryptionKey` was not supplied.",
    );
  }

  contentsMetadataBuffer = await _decompress(
    contentsMetadataBuffer,
    options?.decryptionKey,
  );

  contentsBuffer = await _decompress(contentsBuffer, options?.decryptionKey);

  return {
    /** metadata source is always JSON so we can decode it here */
    metadata: JSON.parse(new TextDecoder().decode(contentsMetadataBuffer)) as T,
    /** data can be anything so the caller must decode it */
    data: contentsBuffer,
  };
};

// `btoa(unescape(encodeURIComponent(str)))` hack doesn't work in edge cases and
// `unescape` API shouldn't be used anyway.
// This implem is ~10x faster than using fromCharCode in a loop (in Chrome).
const stringToByteString = (str: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const blob = new Blob([new TextEncoder().encode(str)]);
    const reader = new FileReader();
    reader.onload = function (event) {
      if (!event.target || typeof event.target.result !== "string") {
        return reject(new Error("couldn't convert to byte string"));
      }
      resolve(event.target.result);
    };
    reader.readAsBinaryString(blob);
  });
};

function byteStringToArrayBuffer(byteString: string) {
  const buffer = new ArrayBuffer(byteString.length);
  const bufferView = new Uint8Array(buffer);
  for (let i = 0, len = byteString.length; i < len; i++) {
    bufferView[i] = byteString.charCodeAt(i);
  }
  return buffer;
}

const byteStringToString = (byteString: string) => {
  return new TextDecoder("utf-8").decode(byteStringToArrayBuffer(byteString));
};

// -----------------------------------------------------------------------------

export const stringToBase64 = async (str: string) => {
  return btoa(await stringToByteString(str));
};

// async to align with stringToBase64
export const base64ToString = async (base64: string) => {
  return byteStringToString(atob(base64));
};

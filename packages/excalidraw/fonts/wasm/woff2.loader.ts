/**
 * Lazy loads wasm and respective bindings for woff2 compression and decompression.
 */
type Vector = any;

let loadedWasm: ReturnType<typeof load> | null = null;

// TODO: add support for fetching the wasm from an URL (external CDN, data URL, etc.)
const load = (): Promise<{
  compress: (buffer: ArrayBuffer) => Uint8Array;
  decompress: (buffer: ArrayBuffer) => Uint8Array;
}> => {
  return new Promise(async (resolve, reject) => {
    try {
      const [binary, bindings] = await Promise.all([
        import("./woff2.wasm"),
        import("./woff2.bindings"),
      ]);

      // initializing the module manually, so that we could pass in the wasm binary
      bindings
        .default({ wasmBinary: binary.default })
        .then(
          (module: {
            woff2Enc: (buffer: ArrayBuffer, byteLength: number) => Vector;
            woff2Dec: (buffer: ArrayBuffer, byteLength: number) => Vector;
          }) => {
            try {
              // re-map from internal vector into byte array
              function convertFromVecToUint8Array(vector: Vector): Uint8Array {
                const arr = [];
                for (let i = 0, l = vector.size(); i < l; i++) {
                  arr.push(vector.get(i));
                }

                return new Uint8Array(arr);
              }

              // re-exporting only compress and decompress functions (also avoids infinite loop inside emscripten bindings)
              const woff2 = {
                compress: (buffer: ArrayBuffer) =>
                  convertFromVecToUint8Array(
                    module.woff2Enc(buffer, buffer.byteLength),
                  ),
                decompress: (buffer: ArrayBuffer) =>
                  convertFromVecToUint8Array(
                    module.woff2Dec(buffer, buffer.byteLength),
                  ),
              };

              resolve(woff2);
            } catch (e) {
              reject(e);
            }
          },
        );
    } catch (e) {
      reject(e);
    }
  });
};

// lazy loaded default export
export default (): ReturnType<typeof load> => {
  if (!loadedWasm) {
    loadedWasm = load();
  }

  return loadedWasm;
};

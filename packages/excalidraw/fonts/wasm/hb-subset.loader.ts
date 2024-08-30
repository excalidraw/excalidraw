/**
 * Lazy loads wasm and respective bindings for font subsetting based on the harfbuzzjs.
 */
let loadedWasm: ReturnType<typeof load> | null = null;

// TODO: add support for fetching the wasm from an URL (external CDN, data URL, etc.)
const load = (): Promise<{
  subset: (
    fontBuffer: ArrayBuffer,
    codePoints: ReadonlySet<number>,
  ) => Uint8Array;
}> => {
  return new Promise(async (resolve, reject) => {
    try {
      const [binary, bindings] = await Promise.all([
        import("./hb-subset.wasm"),
        import("./hb-subset.bindings"),
      ]);

      WebAssembly.instantiate(binary.default).then((module) => {
        try {
          const harfbuzzJsWasm = module.instance.exports;
          // @ts-expect-error since `.buffer` is custom prop
          const heapu8 = new Uint8Array(harfbuzzJsWasm.memory.buffer);

          const hbSubset = {
            subset: (
              fontBuffer: ArrayBuffer,
              codePoints: ReadonlySet<number>,
            ) => {
              return bindings.default.subset(
                harfbuzzJsWasm,
                heapu8,
                fontBuffer,
                codePoints,
              );
            },
          };

          resolve(hbSubset);
        } catch (e) {
          reject(e);
        }
      });
    } catch (error) {
      reject(error);
    }
  });
};

// lazy load the default export
export default (): ReturnType<typeof load> => {
  if (!loadedWasm) {
    loadedWasm = load();
  }

  return loadedWasm;
};

declare module "json-url" {
  export interface Codec {
    compress: (obj: any) => Promise<string>;
    decompress: (compressed: string) => Promise<any>;
  }

  function init(codecName: "lzma" | "lzw" | "lzstring" | "pack"): Codec;
  export default init;
}

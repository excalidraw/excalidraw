import "csstype";

declare module "csstype" {
  interface Properties {
    "--max-width"?: number | string;
    "--swatch-color"?: string;
    "--gap"?: number | string;
    "--padding"?: number | string;
  }
}

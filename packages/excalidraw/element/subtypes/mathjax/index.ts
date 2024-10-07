import type { ExcalidrawImperativeAPI } from "../../../types";
import { useSubtype } from "../";
import { getMathSubtypeRecord } from "./types";
import { prepareMathSubtype } from "./implementation";

declare global {
  module SREfeature {
    function custom(locale: string): Promise<string>;
  }
}

// The main hook to use the MathJax subtype
export const useMathSubtype = (api: ExcalidrawImperativeAPI | null) => {
  useSubtype(api, getMathSubtypeRecord(), prepareMathSubtype);
};

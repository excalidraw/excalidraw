/**
 * Throw from `DiagramToCodePlugin.generate` to fail the generation with
 * a well-known `code` (e.g. "ERR_RATE_LIMIT"), which the plugin's
 * `renderError` can then use to render host-specific UI. Other thrown errors
 * are stored with a generic code.
 */
export class DiagramToCodeError extends Error {
  code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = "DiagramToCodeError";
    this.code = code;
  }
}

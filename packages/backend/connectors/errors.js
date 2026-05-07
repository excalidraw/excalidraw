/**
 * Typed errors used by frontend connectors. Kept in their own module so
 * Express route handlers can `instanceof`-check them without pulling the
 * whole connector registry.
 */

class RendererNotImplementedError extends Error {
  /**
   * @param {string} rendererId
   * @param {Record<string, unknown>} [details]
   */
  constructor(rendererId, details = {}) {
    super(`Renderer "${rendererId}" is not implemented yet.`);
    this.name = "RendererNotImplementedError";
    this.rendererId = rendererId;
    this.details = details;
    this.statusCode = 501;
  }
}

class UnknownRendererError extends Error {
  /**
   * @param {string} rendererId
   * @param {string[]} available
   */
  constructor(rendererId, available) {
    super(
      `Unknown renderer "${rendererId}". Available: ${available.join(", ") || "(none)"}.`,
    );
    this.name = "UnknownRendererError";
    this.rendererId = rendererId;
    this.available = available;
    this.statusCode = 404;
  }
}

module.exports = {
  RendererNotImplementedError,
  UnknownRendererError,
};

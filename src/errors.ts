type CANVAS_ERROR_NAMES = "CANVAS_ERROR" | "CANVAS_POSSIBLY_TOO_BIG";

export class CanvasError extends Error {
  constructor(
    message: string = "Couldn't export canvas.",
    name: CANVAS_ERROR_NAMES = "CANVAS_ERROR",
  ) {
    super();
    this.name = name;
    this.message = message;
  }
}

export class AbortError extends DOMException {
  constructor(message: string = "Request Aborted") {
    super(message, "AbortError");
  }
}

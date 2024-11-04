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

type ImageSceneDataErrorCode =
  | "IMAGE_NOT_CONTAINS_SCENE_DATA"
  | "IMAGE_SCENE_DATA_ERROR";

export class ImageSceneDataError extends Error {
  public code;
  constructor(
    message = "Image Scene Data Error",
    code: ImageSceneDataErrorCode = "IMAGE_SCENE_DATA_ERROR",
  ) {
    super(message);
    this.name = "EncodingError";
    this.code = code;
  }
}

export class InvalidFractionalIndexError extends Error {
  public code = "ELEMENT_HAS_INVALID_INDEX" as const;
}

type WorkerErrorCodes = "WORKER_URL_NOT_DEFINED" | "WORKER_IN_THE_MAIN_CHUNK";

export class WorkerUrlNotDefinedError extends Error {
  public code;
  constructor(
    message = "Worker URL is not defined!",
    code: WorkerErrorCodes = "WORKER_URL_NOT_DEFINED",
  ) {
    super(message);
    this.name = "WorkerUrlNotDefinedError";
    this.code = code;
  }
}

export class WorkerInTheMainChunkError extends Error {
  public code;
  constructor(
    message = "Worker has to be in a separate chunk!",
    code: WorkerErrorCodes = "WORKER_IN_THE_MAIN_CHUNK",
  ) {
    super(message);
    this.name = "WorkerInTheMainChunkError";
    this.code = code;
  }
}

/**
 * Use this for generic, handled errors, so you can check against them
 * and rethrow if needed
 */
export class ExcalidrawError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExcalidrawError";
  }
}

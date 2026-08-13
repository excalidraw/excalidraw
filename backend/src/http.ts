import type { NextFunction, Request, RequestHandler, Response } from "express";

export const asyncHandler = (
  handler: (req: Request, res: Response, next: NextFunction) => Promise<void>,
): RequestHandler => {
  return (req, res, next) => {
    void handler(req, res, next).catch(next);
  };
};

export const isBase64 = (value: unknown): value is string => {
  if (typeof value !== "string" || value.length === 0) {
    return false;
  }
  return /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
    value,
  );
};

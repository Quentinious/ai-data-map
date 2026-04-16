import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { getRequestId } from "./requestId.js";

export type ApiError = {
  code: string;
  message: string;
  requestId: string;
  details?: unknown;
};

function createError(code: string, message: string, requestId: string, details?: unknown): ApiError {
  return { code, message, requestId, details };
}

export function sendError(
  res: Response,
  status: number,
  code: string,
  message: string,
  requestId: string,
  details?: unknown
): void {
  res.status(status).json({ error: createError(code, message, requestId, details) });
}

export function notFoundHandler(req: Request, res: Response): void {
  const requestId = getRequestId(req);
  sendError(res, 404, "NOT_FOUND", `Route ${req.method} ${req.path} not found`, requestId);
}

export function errorHandler(error: unknown, req: Request, res: Response, _next: NextFunction): void {
  const requestId = getRequestId(req) ?? randomUUID();
  console.error(error);
  sendError(res, 500, "INTERNAL_ERROR", "Internal server error", requestId);
}

import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

export type RequestWithId = Request & { requestId: string };

export function requestId(req: Request, res: Response, next: NextFunction): void {
  const requestIdValue = randomUUID();
  (req as RequestWithId).requestId = requestIdValue;
  res.setHeader("x-request-id", requestIdValue);
  next();
}

export function getRequestId(req: Request): string {
  return (req as RequestWithId).requestId;
}

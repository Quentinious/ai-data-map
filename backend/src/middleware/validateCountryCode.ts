import type { NextFunction, Request, Response } from "express";
import { sendError } from "./errorHandler.js";
import { getRequestId } from "./requestId.js";

function isValidCountryCode(value: string): boolean {
  return /^[A-Z]{2}$/.test(value);
}

export function validateCountryCode(req: Request, res: Response, next: NextFunction): void {
  const rawCountryCode = Array.isArray(req.params.countryCode)
    ? req.params.countryCode[0]
    : req.params.countryCode;
  const countryCode = String(rawCountryCode ?? "").toUpperCase();
  req.params.countryCode = countryCode;

  if (!isValidCountryCode(countryCode)) {
    sendError(
      res,
      400,
      "VALIDATION_ERROR",
      "countryCode must be ISO2 format (two uppercase letters)",
      getRequestId(req),
      { countryCode }
    );
    return;
  }

  next();
}

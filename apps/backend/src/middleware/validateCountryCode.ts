import type { NextFunction, Request, Response } from "express";

function isValidCountryCode(value: string): boolean {
  return /^[A-Z]{2}$/.test(value);
}

export function validateCountryCode(req: Request, res: Response, next: NextFunction): void {
  const rawCountryCode = Array.isArray(req.params.countryCode)
    ? req.params.countryCode[0]
    : req.params.countryCode;
  const countryCode = String(rawCountryCode ?? "").toUpperCase();

  if (!isValidCountryCode(countryCode)) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid countryCode",
        details: { countryCode }
      }
    });
    return;
  }

  req.params.countryCode = countryCode;
  next();
}

import { Router } from "express";
import { getCountries } from "../countryReference/loadCountries.js";
import { sendError } from "../middleware/errorHandler.js";
import { validateCountryCode } from "../middleware/validateCountryCode.js";
import { getRequestId } from "../middleware/requestId.js";

const router = Router();

router.get("/countries", (_req, res) => {
  res.json({ data: getCountries() });
});

router.get("/countries/:countryCode", validateCountryCode, (req, res) => {
  const countryCode = req.params.countryCode;
  const country = getCountries().find((item) => item.countryCode === countryCode);

  if (!country) {
    sendError(res, 404, "COUNTRY_NOT_FOUND", `Country ${countryCode} not found`, getRequestId(req));
    return;
  }

  res.json({ data: country });
});

export default router;

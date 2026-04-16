import { Router } from "express";
import { getCountries } from "../countryReference/loadCountries.js";
import { getRequestId } from "../middleware/requestId.js";

const router = Router();

router.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "ai-data-map-backend",
    requestId: getRequestId(req),
    countriesLoaded: getCountries().length
  });
});

export default router;

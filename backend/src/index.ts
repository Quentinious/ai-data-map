// NOTE: not used by current dev task.
import cors from "cors";
import express from "express";
import { loadCountriesOnStart } from "./countryReference/loadCountries.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { requestId } from "./middleware/requestId.js";
import countriesRouter from "./routes/countries.js";
import healthRouter from "./routes/health.js";

const app = express();
const port = Number(process.env.PORT ?? 4000);

app.use(cors());
app.use(express.json());

app.use(requestId);
app.use(healthRouter);
app.use(countriesRouter);
app.use(notFoundHandler);
app.use(errorHandler);

async function start(): Promise<void> {
  await loadCountriesOnStart();
  app.listen(port, () => {
    console.log(`Backend started on http://localhost:${port}`);
  });
}

start().catch((error) => {
  console.error("Failed to start backend", error);
  process.exit(1);
});

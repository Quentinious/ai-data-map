import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "./index.js";

describe("backend API", () => {
  it("returns health status", async () => {
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ok");
    expect(response.body.service).toBe("ai-data-map-backend");
  });

  it("returns country by ISO2 code", async () => {
    const countriesResponse = await request(app).get("/api/countries");
    const firstCountryCode = countriesResponse.body.data[0]?.countryCode;

    expect(countriesResponse.status).toBe(200);
    expect(firstCountryCode).toMatch(/^[A-Z]{2}$/);

    const countryResponse = await request(app).get(`/api/countries/${firstCountryCode}`);

    expect(countryResponse.status).toBe(200);
    expect(countryResponse.body.data.countryCode).toBe(firstCountryCode);
    expect(countryResponse.body.data.aiSummary).toContain("MVP AI summary placeholder");
  });

  it("returns validation error for non-ISO2 code", async () => {
    const response = await request(app).get("/api/countries/USA");

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });
});

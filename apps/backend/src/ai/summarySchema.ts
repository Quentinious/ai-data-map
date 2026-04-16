export const summaryResponseSchema = {
  type: "object",
  required: ["summary", "dataCoverage"],
  properties: {
    summary: {
      type: "array",
      minItems: 2,
      maxItems: 8,
      items: {
        type: "string",
        minLength: 1
      }
    },
    dataCoverage: {
      type: "object",
      required: ["worldbank", "weather"],
      properties: {
        worldbank: { type: "string" },
        weather: { type: "string" }
      }
    }
  }
} as const;

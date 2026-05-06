/**
 * k6 load test: POST /v1/ai/summary
 *
 * Run:
 *   k6 run tests/load/ai-summary.k6.js
 *   k6 run --vus 3 --duration 30s tests/load/ai-summary.k6.js
 *
 * Or via npm:
 *   npm run load:test:ai
 *
 * Environment variables:
 *   BASE_URL     (default: http://127.0.0.1:4000)
 *   DISTRICT_ID  (default: centralny)
 *
 * Note: this test exercises the AI summary endpoint which uses in-memory caching,
 * so subsequent requests for the same district will be served from cache.
 */

import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://127.0.0.1:4000";
const DISTRICT_ID = __ENV.DISTRICT_ID || "centralny";

export const options = {
  vus: 3,
  duration: "20s",
  thresholds: {
    http_req_duration: ["p(95)<3000"],
    http_req_failed: ["rate<0.05"],
  },
};

const districts = ["centralny", "kalininsky", "oktyabrsky", "kirovsky", "sovetsky"];

export default function () {
  const districtId = districts[Math.floor(Math.random() * districts.length)];
  const payload = JSON.stringify({
    districtId,
    filters: { rooms: 2 },
  });

  const params = {
    headers: { "Content-Type": "application/json" },
  };

  const res = http.post(`${BASE_URL}/v1/ai/summary`, payload, params);

  check(res, {
    "status is 200": (r) => r.status === 200,
    "response has summaryText": (r) => {
      try {
        const body = JSON.parse(r.body);
        return typeof body.data?.summaryText === "string" && body.data.summaryText.length > 0;
      } catch {
        return false;
      }
    },
  });

  sleep(2);
}

/**
 * k6 load test: GET /v1/map/districts
 *
 * Run:
 *   k6 run tests/load/map-districts.k6.js
 *   k6 run --vus 10 --duration 30s tests/load/map-districts.k6.js
 *
 * Or via npm:
 *   npm run load:test:map
 *
 * Environment variables:
 *   BASE_URL  (default: http://127.0.0.1:4000)
 */

import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://127.0.0.1:4000";

export const options = {
  vus: 5,
  duration: "20s",
  thresholds: {
    http_req_duration: ["p(95)<500"],
    http_req_failed: ["rate<0.01"],
  },
};

export default function () {
  const res = http.get(`${BASE_URL}/v1/map/districts`);

  check(res, {
    "status is 200": (r) => r.status === 200,
    "response has data": (r) => {
      try {
        const body = JSON.parse(r.body);
        return Array.isArray(body.data) || typeof body.data === "object";
      } catch {
        return false;
      }
    },
  });

  sleep(1);
}

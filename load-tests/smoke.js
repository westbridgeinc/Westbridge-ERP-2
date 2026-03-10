/**
 * k6 smoke test — 5 VUs, 30 seconds.
 * Sanity check that the app is up and responding.
 */
import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = __ENV.K6_BASE_URL || "http://localhost:3000";

export const options = {
  vus: 5,
  duration: "30s",
  thresholds: {
    http_req_failed: ["rate<0.01"],         // <1% errors
    http_req_duration: ["p(95)<2000"],     // 95% < 2s
  },
};

export default function () {
  // Health check
  const health = http.get(`${BASE_URL}/api/health`);
  check(health, { "health: status 200": (r) => r.status === 200 });

  // Liveness
  const live = http.get(`${BASE_URL}/api/health/live`);
  check(live, { "live: status 200": (r) => r.status === 200 });

  // Marketing page
  const home = http.get(`${BASE_URL}/`);
  check(home, { "home: status 200": (r) => r.status === 200 });

  sleep(1);
}

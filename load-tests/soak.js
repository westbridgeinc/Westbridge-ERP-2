/**
 * k6 soak test — 30 VUs for 30 minutes.
 * Detects memory leaks and connection pool exhaustion.
 */
import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = __ENV.K6_BASE_URL || "http://localhost:3000";

export const options = {
  vus: 30,
  duration: "30m",
  thresholds: {
    http_req_failed:   ["rate<0.02"],
    http_req_duration: ["p(95)<3000"],
  },
};

export default function () {
  const health = http.get(`${BASE_URL}/api/health`);
  check(health, { "healthy": (r) => r.status === 200 });

  const live = http.get(`${BASE_URL}/api/health/live`);
  check(live, { "alive": (r) => r.status === 200 });

  sleep(2);
}

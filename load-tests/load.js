/**
 * k6 load test — 50 VUs, 5 minutes.
 * Simulates normal production load across key flows.
 */
import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = __ENV.K6_BASE_URL || "http://localhost:3000";

export const options = {
  stages: [
    { duration: "1m",  target: 50 },  // ramp up
    { duration: "3m",  target: 50 },  // steady state
    { duration: "1m",  target: 0  },  // ramp down
  ],
  thresholds: {
    http_req_failed:   ["rate<0.05"],          // <5% errors
    http_req_duration: ["p(95)<3000"],         // p95 < 3s
    "http_req_duration{route:health}": ["p(99)<500"],
  },
};

export default function () {
  const tags = { route: "health" };

  const health = http.get(`${BASE_URL}/api/health`, { tags });
  check(health, { "health ok": (r) => r.status <= 200 });

  const docs = http.get(`${BASE_URL}/api/docs`, { tags: { route: "docs" } });
  check(docs, { "docs ok": (r) => r.status === 200 });

  // Unauthenticated requests to auth endpoints should rate-limit gracefully
  const loginAttempt = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({ email: "load@test.local", password: "wrong" }),
    { headers: { "Content-Type": "application/json" }, tags: { route: "login" } }
  );
  check(loginAttempt, { "login responds": (r) => r.status === 401 || r.status === 429 });

  sleep(Math.random() * 3 + 1);
}

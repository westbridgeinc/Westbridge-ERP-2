/**
 * k6 stress test — ramp 10→200 VUs over 10 minutes to find breaking point.
 */
import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = __ENV.K6_BASE_URL || "http://localhost:3000";

export const options = {
  stages: [
    { duration: "2m",  target: 10  },
    { duration: "3m",  target: 50  },
    { duration: "2m",  target: 100 },
    { duration: "2m",  target: 200 },
    { duration: "1m",  target: 0   },
  ],
  thresholds: {
    http_req_failed:   ["rate<0.10"],
    http_req_duration: ["p(95)<5000"],
  },
};

export default function () {
  const res = http.get(`${BASE_URL}/api/health`);
  check(res, { "alive": (r) => r.status < 500 });
  sleep(0.5);
}

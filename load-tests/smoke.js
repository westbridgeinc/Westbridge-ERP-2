import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, THINK_TIME } from './config.js';

/**
 * Smoke test — quick sanity check.
 *
 * Verifies that the health endpoints respond correctly under minimal load
 * (1 virtual user for 30 seconds).
 */

export const options = {
  vus: 1,
  duration: '30s',
  thresholds: {
    http_req_duration: ['p(95)<500'],   // 95% of requests must complete in < 500ms
    http_req_failed: ['rate<0.01'],     // less than 1% failure rate
  },
};

export default function () {
  // --- GET /api/health/live ---
  const liveRes = http.get(`${BASE_URL}/api/health/live`, {
    tags: { name: 'health_live' },
  });

  check(liveRes, {
    'health/live returns 200': (r) => r.status === 200,
    'health/live response has alive field': (r) => {
      try {
        const body = r.json();
        return body.alive === true;
      } catch (_) {
        return false;
      }
    },
    'health/live response time < 500ms': (r) => r.timings.duration < 500,
  });

  sleep(THINK_TIME);

  // --- GET /api/health/ready ---
  const readyRes = http.get(`${BASE_URL}/api/health/ready`, {
    tags: { name: 'health_ready' },
  });

  check(readyRes, {
    'health/ready returns 200': (r) => r.status === 200,
    'health/ready response has ready field': (r) => {
      try {
        const body = r.json();
        return typeof body.ready === 'boolean';
      } catch (_) {
        return false;
      }
    },
    'health/ready response time < 500ms': (r) => r.timings.duration < 500,
  });

  sleep(THINK_TIME);
}

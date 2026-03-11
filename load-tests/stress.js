import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { BASE_URL, THINK_TIME } from './config.js';
import { getAuthHeaders, loginAndGetSession, randomDoctype } from './helpers.js';

/**
 * Stress test — pushes the system beyond normal capacity.
 *
 * Ramp up to 200 VUs over 5 minutes, sustain for 10 minutes, ramp down over 3 minutes.
 * Tests how the system handles high load and where breaking points are.
 */

export const options = {
  stages: [
    { duration: '5m', target: 200 },   // ramp up to 200 VUs
    { duration: '10m', target: 200 },   // sustain at 200 VUs
    { duration: '3m', target: 0 },      // ramp down to 0
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'],   // 95% of requests must complete in < 2s
    http_req_failed: ['rate<0.05'],      // less than 5% failure rate
  },
};

// --------------------------------------------------------------------------
// Scenario picker — same distribution as average-load
// --------------------------------------------------------------------------

const SCENARIOS = [
  { weight: 10, fn: scenarioHealthCheck },
  { weight: 20, fn: scenarioLogin },
  { weight: 15, fn: scenarioCsrfFetch },
  { weight: 30, fn: scenarioErpList },
  { weight: 25, fn: scenarioErpDocFetch },
];

const TOTAL_WEIGHT = SCENARIOS.reduce((sum, s) => sum + s.weight, 0);

function pickScenario() {
  let rand = Math.random() * TOTAL_WEIGHT;
  for (const s of SCENARIOS) {
    rand -= s.weight;
    if (rand <= 0) return s.fn;
  }
  return SCENARIOS[SCENARIOS.length - 1].fn;
}

// --------------------------------------------------------------------------
// Scenarios
// --------------------------------------------------------------------------

function scenarioHealthCheck() {
  group('health_check', () => {
    const res = http.get(`${BASE_URL}/api/health/live`, {
      tags: { name: 'health_live' },
    });
    check(res, {
      'health/live returns 200': (r) => r.status === 200,
      'health/live response time OK': (r) => r.timings.duration < 2000,
    });
  });
}

function scenarioLogin() {
  group('login_attempt', () => {
    const csrfRes = http.get(`${BASE_URL}/api/csrf`, {
      tags: { name: 'csrf_fetch' },
    });

    let csrfToken = '';
    if (csrfRes.status === 200) {
      try {
        csrfToken = csrfRes.json().data.token;
      } catch (_) {
        csrfToken = '';
      }
    }

    check(csrfRes, {
      'csrf returns 200': (r) => r.status === 200,
    });

    sleep(THINK_TIME);

    const email = __ENV.LOAD_TEST_EMAIL || 'loadtest@example.com';
    const password = __ENV.LOAD_TEST_PASSWORD || 'Test1234!';

    const loginRes = http.post(
      `${BASE_URL}/api/auth/login`,
      JSON.stringify({ email, password }),
      {
        headers: getAuthHeaders(csrfToken),
        tags: { name: 'login' },
      },
    );

    check(loginRes, {
      'login returns 200 or expected error': (r) =>
        r.status === 200 || r.status === 401 || r.status === 429,
      'login response time OK': (r) => r.timings.duration < 2000,
    });
  });
}

function scenarioCsrfFetch() {
  group('csrf_token_fetch', () => {
    const res = http.get(`${BASE_URL}/api/csrf`, {
      tags: { name: 'csrf_fetch' },
    });
    check(res, {
      'csrf returns 200': (r) => r.status === 200,
      'csrf body contains token': (r) => {
        try {
          return !!r.json().data.token;
        } catch (_) {
          return false;
        }
      },
      'csrf response time OK': (r) => r.timings.duration < 2000,
    });
  });
}

function scenarioErpList() {
  group('erp_list', () => {
    const { jar, csrfToken } = loginAndGetSession();

    sleep(THINK_TIME);

    const doctype = randomDoctype();
    const res = http.get(
      `${BASE_URL}/api/erp/list?doctype=${encodeURIComponent(doctype)}&limit=20&page=0`,
      {
        headers: getAuthHeaders(csrfToken),
        jar,
        tags: { name: 'erp_list' },
      },
    );

    check(res, {
      'erp/list returns 200 or expected error': (r) =>
        r.status === 200 || r.status === 401 || r.status === 429,
      'erp/list response time OK': (r) => r.timings.duration < 2000,
    });
  });
}

function scenarioErpDocFetch() {
  group('erp_doc_fetch', () => {
    const { jar, csrfToken } = loginAndGetSession();

    sleep(THINK_TIME);

    const doctype = randomDoctype();
    const listRes = http.get(
      `${BASE_URL}/api/erp/list?doctype=${encodeURIComponent(doctype)}&limit=5&page=0`,
      {
        headers: getAuthHeaders(csrfToken),
        jar,
        tags: { name: 'erp_list_for_doc' },
      },
    );

    let docName = '';
    if (listRes.status === 200) {
      try {
        const body = listRes.json();
        const items = body.data || [];
        if (items.length > 0) {
          docName = items[0].name || '';
        }
      } catch (_) {
        // skip doc fetch if list parsing fails
      }
    }

    if (docName) {
      sleep(THINK_TIME);

      const docRes = http.get(
        `${BASE_URL}/api/erp/doc?doctype=${encodeURIComponent(doctype)}&name=${encodeURIComponent(docName)}`,
        {
          headers: getAuthHeaders(csrfToken),
          jar,
          tags: { name: 'erp_doc' },
        },
      );

      check(docRes, {
        'erp/doc returns 200 or expected error': (r) =>
          r.status === 200 || r.status === 401 || r.status === 429,
        'erp/doc response time OK': (r) => r.timings.duration < 2000,
      });
    }
  });
}

// --------------------------------------------------------------------------
// Main
// --------------------------------------------------------------------------

export default function () {
  const scenario = pickScenario();
  scenario();
  sleep(THINK_TIME);
}

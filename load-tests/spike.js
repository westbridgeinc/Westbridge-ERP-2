import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { BASE_URL, THINK_TIME } from './config.js';
import { getAuthHeaders, loginAndGetSession, randomDoctype } from './helpers.js';

/**
 * Spike test — simulates a sudden burst of traffic.
 *
 * Starts with 10 VUs for 1 minute, spikes to 300 VUs in 30 seconds,
 * holds at 300 for 2 minutes, then drops back to 10 in 30 seconds.
 * Tests the system's ability to handle and recover from sudden traffic spikes.
 */

export const options = {
  stages: [
    { duration: '1m', target: 10 },     // warm up with 10 VUs
    { duration: '30s', target: 300 },    // spike to 300 VUs
    { duration: '2m', target: 300 },     // hold at 300 VUs
    { duration: '30s', target: 10 },     // drop back to 10 VUs
  ],
  thresholds: {
    // Spike tests use relaxed thresholds — the goal is observing behavior,
    // not enforcing strict SLAs during the spike itself.
    http_req_duration: ['p(95)<3000'],    // 95% of requests < 3s
    http_req_failed: ['rate<0.10'],       // less than 10% failure rate
  },
};

// --------------------------------------------------------------------------
// Scenario picker — same distribution as other tests
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
      'csrf returns 200 or 429': (r) => r.status === 200 || r.status === 429,
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
      'login returns expected status': (r) =>
        r.status === 200 || r.status === 401 || r.status === 429,
    });
  });
}

function scenarioCsrfFetch() {
  group('csrf_token_fetch', () => {
    const res = http.get(`${BASE_URL}/api/csrf`, {
      tags: { name: 'csrf_fetch' },
    });
    check(res, {
      'csrf returns 200 or 429': (r) => r.status === 200 || r.status === 429,
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
      'erp/list returns expected status': (r) =>
        r.status === 200 || r.status === 401 || r.status === 429,
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
        'erp/doc returns expected status': (r) =>
          r.status === 200 || r.status === 401 || r.status === 429,
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

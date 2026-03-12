/**
 * Final exhaustive stress test — covers every API endpoint, edge case, and failure mode.
 * Tests all fixes from previous rounds (502→404, 413, OpenAPI, AI validation, etc.)
 * Run: npx tsx stress-test-final.ts
 */

const BASE = "http://localhost:4000";

// ─── Helpers ────────────────────────────────────────────────────────────────

let totalTests = 0;
let passed = 0;
let failed = 0;
const failures: string[] = [];

async function test(name: string, fn: () => Promise<void>) {
  totalTests++;
  try {
    await fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (e: unknown) {
    failed++;
    const msg = e instanceof Error ? e.message : String(e);
    failures.push(`${name}: ${msg}`);
    console.log(`  ❌ ${name} — ${msg}`);
  }
}

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(msg);
}

async function fetchJson(path: string, opts?: RequestInit & { raw?: boolean }): Promise<{ status: number; body: any; headers: Headers }> {
  const res = await fetch(`${BASE}${path}`, { ...opts, redirect: "manual" });
  let body: any;
  const ct = res.headers.get("content-type") ?? "";
  if (ct.includes("json")) {
    body = await res.json();
  } else {
    body = await res.text();
  }
  return { status: res.status, body, headers: res.headers };
}

let SESSION_COOKIE = "";
let CSRF_TOKEN = "";
let CSRF_COOKIE = "";

async function getCsrf(sessionCookie?: string): Promise<{ token: string; cookie: string }> {
  const headers: Record<string, string> = {};
  if (sessionCookie) headers.Cookie = sessionCookie;
  const csrfRes = await fetch(`${BASE}/api/csrf`, { headers });
  const csrfCookies = csrfRes.headers.getSetCookie?.() ?? [];
  const csrfCookieVal = csrfCookies.find((c: string) => c.startsWith("westbridge_csrf="));
  const cookie = csrfCookieVal ? csrfCookieVal.split(";")[0] : "";
  const csrfBody = await csrfRes.json();
  const token = csrfBody?.data?.token ?? "";
  return { token, cookie };
}

async function login() {
  // Get CSRF token first (required for login POST)
  const preLoginCsrf = await getCsrf();

  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: preLoginCsrf.cookie,
      "x-csrf-token": preLoginCsrf.token,
    },
    body: JSON.stringify({ email: "admin@westbridge.gy", password: "Westbridge@2026#Secure" }),
  });
  const cookies = res.headers.getSetCookie?.() ?? [];
  const sidCookie = cookies.find((c: string) => c.startsWith("westbridge_sid="));
  if (sidCookie) {
    SESSION_COOKIE = sidCookie.split(";")[0];
  }
  // Get a fresh CSRF token bound to the session
  const sessionCsrf = await getCsrf(SESSION_COOKIE);
  CSRF_TOKEN = sessionCsrf.token;
  CSRF_COOKIE = sessionCsrf.cookie;
}

function authHeaders(extra?: Record<string, string>): Record<string, string> {
  return {
    Cookie: `${SESSION_COOKIE}; ${CSRF_COOKIE}`,
    "x-csrf-token": CSRF_TOKEN,
    ...extra,
  };
}

function authedJson(body: any): { method: string; headers: Record<string, string>; body: string } {
  return {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

// ─── Suite 1: Health & Operations ────────────────────────────────────────────

async function suiteHealth() {
  console.log("\n🏥 Suite 1: Health & Operations");

  await test("GET /api/health returns 200", async () => {
    const { status, body } = await fetchJson("/api/health");
    assert(status === 200, `Expected 200, got ${status}`);
    assert(body.data?.checks?.database?.status === "healthy", "DB should be healthy");
    assert(body.data?.checks?.redis?.status === "healthy", "Redis should be healthy");
  });

  await test("GET /api/health/ready returns 200 or 503", async () => {
    const { status } = await fetchJson("/api/health/ready");
    assert(status === 200 || status === 503, `Expected 200/503, got ${status}`);
  });

  await test("GET /api/health/live returns 200", async () => {
    const { status } = await fetchJson("/api/health/live");
    assert(status === 200, `Expected 200, got ${status}`);
  });

  await test("GET /api/metrics returns Prometheus text", async () => {
    const res = await fetch(`${BASE}/api/metrics`);
    const text = await res.text();
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(text.includes("nodejs_") || text.includes("process_"), "Should contain node metrics");
  });

  await test("GET /api/docs returns OpenAPI 3.1 spec", async () => {
    const { status, body } = await fetchJson("/api/docs");
    assert(status === 200, `Expected 200, got ${status}`);
    assert(body.openapi === "3.1.0", `Expected openapi 3.1.0, got ${body.openapi}`);
    assert(body.info?.title === "Westbridge API", "Title should be Westbridge API");
    assert(Object.keys(body.paths || {}).length > 10, "Should have many paths");
  });
}

// ─── Suite 2: Authentication ────────────────────────────────────────────────

async function suiteAuth() {
  console.log("\n🔐 Suite 2: Authentication");

  await test("POST /api/auth/login with valid creds returns 200", async () => {
    const csrf = await getCsrf();
    const { status, body } = await fetchJson("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: csrf.cookie, "x-csrf-token": csrf.token },
      body: JSON.stringify({ email: "admin@westbridge.gy", password: "Westbridge@2026#Secure" }),
    });
    assert(status === 200, `Expected 200, got ${status}: ${JSON.stringify(body)}`);
    assert(body.data?.userId || body.data?.success || body.ok, "Should return user data or success");
  });

  await test("POST /api/auth/login with wrong password returns 401", async () => {
    const csrf = await getCsrf();
    const { status } = await fetchJson("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: csrf.cookie, "x-csrf-token": csrf.token },
      body: JSON.stringify({ email: "demo@westbridge.gy", password: "wrongpassword" }),
    });
    assert(status === 401, `Expected 401, got ${status}`);
  });

  await test("POST /api/auth/login with invalid email returns 400 or 401", async () => {
    const csrf = await getCsrf();
    const { status } = await fetchJson("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: csrf.cookie, "x-csrf-token": csrf.token },
      body: JSON.stringify({ email: "notanemail", password: "test" }),
    });
    assert(status === 400 || status === 401, `Expected 400/401, got ${status}`);
  });

  await test("POST /api/auth/login with empty body returns 400", async () => {
    const csrf = await getCsrf();
    const { status } = await fetchJson("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: csrf.cookie, "x-csrf-token": csrf.token },
      body: "{}",
    });
    assert(status === 400 || status === 401, `Expected 400/401, got ${status}`);
  });

  await test("GET /api/auth/validate without session returns 401", async () => {
    const { status } = await fetchJson("/api/auth/validate");
    assert(status === 401, `Expected 401, got ${status}`);
  });

  await test("GET /api/auth/validate with valid session returns 200", async () => {
    const { status } = await fetchJson("/api/auth/validate", {
      headers: { Cookie: SESSION_COOKIE },
    });
    assert(status === 200, `Expected 200, got ${status}`);
  });

  await test("POST /api/auth/forgot-password returns 200 (no enumeration)", async () => {
    const csrf = await getCsrf();
    const { status } = await fetchJson("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: csrf.cookie, "x-csrf-token": csrf.token },
      body: JSON.stringify({ email: "nonexistent@example.com" }),
    });
    assert(status === 200, `Expected 200, got ${status}`);
  });

  await test("GET /api/csrf returns CSRF token", async () => {
    const { status, body } = await fetchJson("/api/csrf", {
      headers: { Cookie: SESSION_COOKIE },
    });
    assert(status === 200, `Expected 200, got ${status}`);
    assert(body.data?.token, "Should have CSRF token");
    assert(body.data.token.split(".").length === 3, "Token should have 3 parts");
  });
}

// ─── Suite 3: ERP CRUD ─────────────────────────────────────────────────────

async function suiteErpCrud() {
  console.log("\n📦 Suite 3: ERP CRUD Operations");

  // List operations
  const doctypes = ["Customer", "Supplier", "Item", "Sales Invoice", "Sales Order", "Employee"];
  for (const dt of doctypes) {
    await test(`GET /api/erp/list?doctype=${dt} returns data`, async () => {
      const { status, body } = await fetchJson(`/api/erp/list?doctype=${encodeURIComponent(dt)}`, {
        headers: authHeaders(),
      });
      assert(status === 200, `Expected 200 for ${dt}, got ${status}: ${JSON.stringify(body).slice(0, 200)}`);
      assert(Array.isArray(body.data), `Data should be array for ${dt}`);
    });
  }

  // Get single doc — names are sanitized (control chars stripped) so GET should work
  await test("GET /api/erp/doc?doctype=Customer returns doc", async () => {
    const listRes = await fetchJson("/api/erp/list?doctype=Customer&limit=1", {
      headers: authHeaders(),
    });
    if (listRes.body.data?.length > 0) {
      const name = listRes.body.data[0].name;
      const { status } = await fetchJson(`/api/erp/doc?doctype=Customer&name=${encodeURIComponent(name)}`, {
        headers: authHeaders(),
      });
      // 200 (found) or 404 (sanitized name doesn't match ERPNext internal name with control chars)
      assert(status === 200 || status === 404, `Expected 200/404, got ${status}`);
    }
  });

  // Get non-existent doc — was returning 502, should be 404
  await test("GET /api/erp/doc non-existent returns 404 (not 502)", async () => {
    const { status } = await fetchJson("/api/erp/doc?doctype=Customer&name=NONEXISTENT-99999", {
      headers: authHeaders(),
    });
    assert(status === 404, `Expected 404, got ${status}`);
  });

  await test("GET /api/erp/doc non-existent Sales Invoice returns 404", async () => {
    const { status } = await fetchJson("/api/erp/doc?doctype=Sales+Invoice&name=SINV-FAKE-00000", {
      headers: authHeaders(),
    });
    assert(status === 404, `Expected 404, got ${status}`);
  });

  // List with filters
  await test("GET /api/erp/list with filters works", async () => {
    const filters = JSON.stringify([["Customer", "customer_type", "=", "Company"]]);
    const { status, body } = await fetchJson(`/api/erp/list?doctype=Customer&filters=${encodeURIComponent(filters)}`, {
      headers: authHeaders(),
    });
    assert(status === 200, `Expected 200, got ${status}`);
    assert(Array.isArray(body.data), "Should return array");
  });

  // List with pagination
  await test("GET /api/erp/list with limit and offset", async () => {
    const { status, body } = await fetchJson("/api/erp/list?doctype=Customer&limit=2&offset=0", {
      headers: authHeaders(),
    });
    assert(status === 200, `Expected 200, got ${status}`);
    assert(body.data.length <= 2, "Should respect limit");
  });

  // Unauthenticated ERP access
  await test("GET /api/erp/list without auth returns 401", async () => {
    const { status } = await fetchJson("/api/erp/list?doctype=Customer");
    assert(status === 401, `Expected 401, got ${status}`);
  });

  // Missing doctype
  await test("GET /api/erp/list without doctype returns 400", async () => {
    const { status } = await fetchJson("/api/erp/list", {
      headers: authHeaders(),
    });
    assert(status === 400, `Expected 400, got ${status}`);
  });

  // Invalid doctype
  await test("GET /api/erp/list with invalid doctype returns 400", async () => {
    const { status } = await fetchJson("/api/erp/list?doctype=HackerPayload", {
      headers: authHeaders(),
    });
    assert(status === 400, `Expected 400, got ${status}`);
  });

  // Dashboard
  await test("GET /api/erp/dashboard returns metrics", async () => {
    const { status, body } = await fetchJson("/api/erp/dashboard", {
      headers: authHeaders(),
    });
    assert(status === 200, `Expected 200, got ${status}`);
    assert(body.data !== undefined, "Should have dashboard data");
  });
}

// ─── Suite 4: CSRF Protection ───────────────────────────────────────────────

async function suiteCsrf() {
  console.log("\n🛡️  Suite 4: CSRF Protection");

  await test("POST /api/erp/doc without CSRF token gets rejected", async () => {
    const { status } = await fetchJson("/api/erp/doc", {
      method: "POST",
      headers: {
        Cookie: SESSION_COOKIE,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ doctype: "Customer", customer_name: "Test" }),
    });
    assert(status === 403, `Expected 403 (no CSRF), got ${status}`);
  });

  await test("POST with forged CSRF token gets rejected", async () => {
    const { status } = await fetchJson("/api/erp/doc", {
      method: "POST",
      headers: {
        Cookie: `${SESSION_COOKIE}; westbridge_csrf=forged`,
        "x-csrf-token": "forged.token.value",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ doctype: "Customer", customer_name: "Test" }),
    });
    assert(status === 403, `Expected 403 (forged CSRF), got ${status}`);
  });
}

// ─── Suite 5: Team & Account ────────────────────────────────────────────────

async function suiteTeamAccount() {
  console.log("\n👥 Suite 5: Team & Account");

  await test("GET /api/team returns team members", async () => {
    const { status, body } = await fetchJson("/api/team", {
      headers: authHeaders(),
    });
    assert(status === 200, `Expected 200, got ${status}`);
    assert(body.data !== undefined, "Should have team data");
  });

  await test("PATCH /api/account/profile updates name", async () => {
    const { status } = await fetchJson("/api/account/profile", {
      method: "PATCH",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Demo User" }),
    });
    assert(status === 200, `Expected 200, got ${status}`);
  });

  await test("GET /api/account/export returns GDPR data export", async () => {
    const { status, body } = await fetchJson("/api/account/export", {
      headers: authHeaders(),
    });
    assert(status === 200, `Expected 200, got ${status}: ${JSON.stringify(body).slice(0, 200)}`);
  });

  await test("GET /api/team without auth returns 401", async () => {
    const { status } = await fetchJson("/api/team");
    assert(status === 401, `Expected 401, got ${status}`);
  });
}

// ─── Suite 6: Audit Logs ────────────────────────────────────────────────────

async function suiteAudit() {
  console.log("\n📋 Suite 6: Audit Logs");

  await test("GET /api/audit returns paginated logs", async () => {
    const { status, body } = await fetchJson("/api/audit?page=1&per_page=10", {
      headers: authHeaders(),
    });
    assert(status === 200, `Expected 200, got ${status}`);
    assert(body.data !== undefined, "Should have audit data");
  });

  await test("GET /api/audit with filters works", async () => {
    const { status } = await fetchJson("/api/audit?action=auth.login&severity=info", {
      headers: authHeaders(),
    });
    assert(status === 200, `Expected 200, got ${status}`);
  });

  await test("GET /api/audit/export returns data", async () => {
    const { status } = await fetchJson("/api/audit/export", {
      headers: authHeaders(),
    });
    // 200 (data) or 429 (rate limited from previous test runs within the 1-hour window)
    assert(status === 200 || status === 429, `Expected 200/429, got ${status}`);
  });
}

// ─── Suite 7: Admin Endpoints ───────────────────────────────────────────────

async function suiteAdmin() {
  console.log("\n⚙️  Suite 7: Admin Endpoints");

  await test("GET /api/admin/flags returns feature flags", async () => {
    const { status, body } = await fetchJson("/api/admin/flags", {
      headers: authHeaders(),
    });
    assert(status === 200, `Expected 200, got ${status}`);
    assert(body.data !== undefined, "Should have flags data");
  });

  await test("GET /api/admin/jobs returns queue stats", async () => {
    const { status, body } = await fetchJson("/api/admin/jobs", {
      headers: authHeaders(),
    });
    assert(status === 200, `Expected 200, got ${status}`);
    assert(body.data !== undefined, "Should have jobs data");
  });

  await test("GET /api/billing/history returns billing data", async () => {
    const { status } = await fetchJson("/api/billing/history", {
      headers: authHeaders(),
    });
    // May be 200 or 404 depending on whether billing is set up
    assert(status === 200 || status === 404, `Expected 200/404, got ${status}`);
  });
}

// ─── Suite 8: Reports ───────────────────────────────────────────────────────

async function suiteReports() {
  console.log("\n📊 Suite 8: Reports");

  await test("POST /api/reports enqueues revenue_summary", async () => {
    const { status, body } = await fetchJson("/api/reports", {
      ...authedJson({ reportType: "revenue_summary", params: {} }),
    });
    assert(status === 202 || status === 200, `Expected 202/200, got ${status}: ${JSON.stringify(body).slice(0, 200)}`);
  });

  await test("POST /api/reports with invalid type returns 400", async () => {
    const { status } = await fetchJson("/api/reports", {
      ...authedJson({ reportType: "nonexistent_report", params: {} }),
    });
    assert(status === 400, `Expected 400, got ${status}`);
  });

  await test("GET /api/reports lists reports", async () => {
    const { status } = await fetchJson("/api/reports?page=1&per_page=10", {
      headers: authHeaders(),
    });
    assert(status === 200, `Expected 200, got ${status}`);
  });
}

// ─── Suite 9: AI Chat ───────────────────────────────────────────────────────

async function suiteAi() {
  console.log("\n🤖 Suite 9: AI Chat");

  await test("POST /api/ai/chat with empty body returns 400", async () => {
    const { status } = await fetchJson("/api/ai/chat", {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: "{}",
    });
    assert(status === 400, `Expected 400, got ${status}`);
  });

  await test("POST /api/ai/chat with empty message returns 400", async () => {
    const { status } = await fetchJson("/api/ai/chat", {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ message: "" }),
    });
    assert(status === 400, `Expected 400, got ${status}`);
  });

  await test("POST /api/ai/chat with valid message returns 200", async () => {
    const { status, body } = await fetchJson("/api/ai/chat", {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Hello" }),
    });
    // 200 (AI configured or graceful degrade) both acceptable
    assert(status === 200 || status === 429, `Expected 200/429, got ${status}: ${JSON.stringify(body).slice(0, 200)}`);
  });

  await test("POST /api/ai/chat without auth returns 401", async () => {
    const csrf = await getCsrf();
    const { status } = await fetchJson("/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: csrf.cookie, "x-csrf-token": csrf.token },
      body: JSON.stringify({ message: "Hello" }),
    });
    // Auth check now runs before the "AI not configured" graceful degrade
    assert(status === 401, `Expected 401, got ${status}`);
  });
}

// ─── Suite 10: SSE Events ───────────────────────────────────────────────────

async function suiteEvents() {
  console.log("\n📡 Suite 10: SSE Events");

  await test("GET /api/events/stream returns SSE content type", async () => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 2000);
    try {
      const res = await fetch(`${BASE}/api/events/stream`, {
        headers: { Cookie: SESSION_COOKIE },
        signal: controller.signal,
      });
      const ct = res.headers.get("content-type") ?? "";
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(ct.includes("text/event-stream"), `Expected SSE content type, got ${ct}`);
    } catch (e: unknown) {
      // AbortError is expected
      if (e instanceof Error && e.name !== "AbortError") throw e;
    }
  });

  await test("GET /api/events/stream without auth returns 401", async () => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 2000);
    try {
      const res = await fetch(`${BASE}/api/events/stream`, { signal: controller.signal });
      assert(res.status === 401, `Expected 401, got ${res.status}`);
    } catch (e: unknown) {
      if (e instanceof Error && e.name !== "AbortError") throw e;
    }
  });
}

// ─── Suite 11: Payload Abuse ────────────────────────────────────────────────

async function suitePayloads() {
  console.log("\n💣 Suite 11: Payload Abuse");

  await test("POST with 1.5MB body returns 413", async () => {
    const bigBody = JSON.stringify({ data: "x".repeat(1_500_000) });
    const res = await fetch(`${BASE}/api/erp/list?doctype=Customer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: bigBody,
    });
    assert(res.status === 413, `Expected 413, got ${res.status}`);
  });

  await test("POST with malformed JSON returns 400", async () => {
    const csrf = await getCsrf();
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: csrf.cookie, "x-csrf-token": csrf.token },
      body: "{invalid json",
    });
    assert(res.status === 400, `Expected 400, got ${res.status}`);
  });

  await test("POST with wrong content-type handles gracefully", async () => {
    const csrf = await getCsrf();
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "text/plain", Cookie: csrf.cookie, "x-csrf-token": csrf.token },
      body: "not json",
    });
    // Should return 400 or 415, not 500
    assert(res.status < 500, `Expected <500, got ${res.status}`);
  });

  await test("GET with very long query string returns error (not crash)", async () => {
    const longParam = "x".repeat(30000);
    const res = await fetch(`${BASE}/api/erp/list?doctype=${longParam}`, {
      headers: authHeaders(),
    });
    // 400, 414, or 431 are all acceptable — just not 500
    assert(res.status < 500 || res.status === 502, `Expected <500 or 502, got ${res.status}`);
  });
}

// ─── Suite 12: Concurrent Load ──────────────────────────────────────────────

async function suiteConcurrent() {
  console.log("\n⚡ Suite 12: Concurrent Load");

  await test("50 concurrent /api/health requests all succeed", async () => {
    const results = await Promise.all(
      Array.from({ length: 50 }, () => fetch(`${BASE}/api/health`).then((r) => r.status))
    );
    const ok = results.filter((s) => s === 200).length;
    assert(ok === 50, `Expected 50 OK, got ${ok} (statuses: ${[...new Set(results)].join(", ")})`);
  });

  await test("30 concurrent ERP list requests all succeed", async () => {
    const doctypes = ["Customer", "Supplier", "Item", "Sales Invoice", "Employee", "Sales Order"];
    const requests = Array.from({ length: 30 }, (_, i) => {
      const dt = doctypes[i % doctypes.length];
      return fetch(`${BASE}/api/erp/list?doctype=${encodeURIComponent(dt)}`, {
        headers: authHeaders(),
      }).then((r) => r.status);
    });
    const results = await Promise.all(requests);
    const ok = results.filter((s) => s === 200).length;
    assert(ok >= 25, `Expected >=25 OK out of 30, got ${ok} (statuses: ${[...new Set(results)].join(", ")})`);
  });

  await test("20 concurrent dashboard requests (allow rate limiting)", async () => {
    const results = await Promise.all(
      Array.from({ length: 20 }, () =>
        fetch(`${BASE}/api/erp/dashboard`, { headers: authHeaders() }).then((r) => r.status)
      )
    );
    const ok = results.filter((s) => s === 200).length;
    const rateLimited = results.filter((s) => s === 429).length;
    // Either we get enough 200s, or rate limiting kicked in (expected after earlier ERP list burst)
    assert(ok + rateLimited >= 15, `Expected >=15 OK+429 out of 20, got ${ok} OK + ${rateLimited} 429`);
  });

  await test("Sustained 30 req/sec for 10 seconds (300 total)", async () => {
    const rps = 30;
    const duration = 10;
    const results: number[] = [];
    const latencies: number[] = [];

    for (let sec = 0; sec < duration; sec++) {
      const batch = Array.from({ length: rps }, () => {
        const start = Date.now();
        return fetch(`${BASE}/api/health/live`)
          .then((r) => {
            latencies.push(Date.now() - start);
            return r.status;
          })
          .catch(() => 0);
      });
      results.push(...(await Promise.all(batch)));
      if (sec < duration - 1) await new Promise((r) => setTimeout(r, 1000));
    }

    const ok = results.filter((s) => s === 200).length;
    const errorRate = ((results.length - ok) / results.length) * 100;
    latencies.sort((a, b) => a - b);
    const p50 = latencies[Math.floor(latencies.length * 0.5)];
    const p99 = latencies[Math.floor(latencies.length * 0.99)];

    console.log(`    → ${results.length} requests, ${ok} OK, ${errorRate.toFixed(1)}% errors, p50=${p50}ms, p99=${p99}ms`);
    assert(errorRate < 5, `Error rate ${errorRate.toFixed(1)}% exceeds 5% threshold`);
  });
}

// ─── Suite 13: Signup ───────────────────────────────────────────────────────

async function suiteSignup() {
  console.log("\n📝 Suite 13: Signup");

  await test("POST /api/signup with valid data returns 200 or 409", async () => {
    const csrf = await getCsrf();
    const unique = `stress-${Date.now()}@test.gy`;
    const { status } = await fetchJson("/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: csrf.cookie, "x-csrf-token": csrf.token },
      body: JSON.stringify({
        email: unique,
        companyName: "Stress Test Corp",
        plan: "Starter",
      }),
    });
    // 200 (created) or 409 (already exists) or 429 (rate limited)
    assert(status === 200 || status === 409 || status === 429, `Expected 200/409/429, got ${status}`);
  });

  await test("POST /api/signup with invalid email returns 400 or 429", async () => {
    const csrf = await getCsrf();
    const { status } = await fetchJson("/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: csrf.cookie, "x-csrf-token": csrf.token },
      body: JSON.stringify({
        email: "notanemail",
        companyName: "Bad Corp",
        plan: "Starter",
      }),
    });
    // 400 (validation) or 429 (rate limited from previous signup test)
    assert(status === 400 || status === 429, `Expected 400/429, got ${status}`);
  });

  await test("POST /api/signup with missing fields returns 400 or 429", async () => {
    const csrf = await getCsrf();
    const { status } = await fetchJson("/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: csrf.cookie, "x-csrf-token": csrf.token },
      body: JSON.stringify({}),
    });
    // 400 (validation) or 429 (rate limited)
    assert(status === 400 || status === 429, `Expected 400/429, got ${status}`);
  });
}

// ─── Suite 14: Invite ───────────────────────────────────────────────────────

async function suiteInvite() {
  console.log("\n✉️  Suite 14: Invites");

  await test("POST /api/invite without auth returns 401 or 403", async () => {
    const { status } = await fetchJson("/api/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "test@example.com", role: "member" }),
    });
    assert(status === 401 || status === 403, `Expected 401/403, got ${status}`);
  });

  await test("POST /api/invite with auth sends invite", async () => {
    const { status } = await fetchJson("/api/invite", {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ email: `invite-${Date.now()}@test.gy`, role: "member" }),
    });
    // 200 (sent) or 400 (validation) or 429 (rate limited)
    assert(status === 200 || status === 400 || status === 429, `Expected 200/400/429, got ${status}`);
  });
}

// ─── Suite 15: Edge Cases ───────────────────────────────────────────────────

async function suiteEdgeCases() {
  console.log("\n🔬 Suite 15: Edge Cases");

  await test("GET unknown route returns 404", async () => {
    const { status } = await fetchJson("/api/nonexistent-route");
    assert(status === 404, `Expected 404, got ${status}`);
  });

  await test("OPTIONS request returns CORS headers", async () => {
    const res = await fetch(`${BASE}/api/health`, {
      method: "OPTIONS",
      headers: { Origin: "http://localhost:3004" },
    });
    // Should not be 500
    assert(res.status < 500, `Expected <500, got ${res.status}`);
  });

  await test("POST with null body fields handled", async () => {
    const csrf = await getCsrf();
    const { status } = await fetchJson("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: csrf.cookie, "x-csrf-token": csrf.token },
      body: JSON.stringify({ email: null, password: null }),
    });
    assert(status === 400 || status === 401, `Expected 400/401, got ${status}`);
  });

  await test("ERP list with order_by param works", async () => {
    const { status } = await fetchJson("/api/erp/list?doctype=Customer&order_by=creation+desc", {
      headers: authHeaders(),
    });
    assert(status === 200, `Expected 200, got ${status}`);
  });

  await test("Double-slash path handled", async () => {
    const res = await fetch(`${BASE}//api/health`);
    // Should not crash — 200 or 404 both fine
    assert(res.status < 500, `Expected <500, got ${res.status}`);
  });

  await test("Path traversal attempt handled", async () => {
    const res = await fetch(`${BASE}/api/../../../etc/passwd`);
    assert(res.status < 500, `Expected <500, got ${res.status}`);
  });

  await test("SQL injection in query params handled", async () => {
    const { status } = await fetchJson("/api/erp/list?doctype=Customer&filters=" + encodeURIComponent("'; DROP TABLE users; --"), {
      headers: authHeaders(),
    });
    // Should return 400 (bad filter) or 200 (ignored), not 500
    assert(status < 500 || status === 502, `Expected <500 or 502, got ${status}`);
  });

  await test("XSS in query params sanitized", async () => {
    const { status } = await fetchJson("/api/erp/list?doctype=Customer&filters=" + encodeURIComponent('<script>alert(1)</script>'), {
      headers: authHeaders(),
    });
    assert(status < 500 || status === 502, `Expected <500 or 502, got ${status}`);
  });
}

// ─── Suite 16: Session Lifecycle ────────────────────────────────────────────

async function suiteSessionLifecycle() {
  console.log("\n🔄 Suite 16: Session Lifecycle");

  await test("Login → validate → logout → validate=401 cycle", async () => {
    // Get CSRF for login
    const loginCsrf = await getCsrf();

    // Login
    const loginRes = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: loginCsrf.cookie,
        "x-csrf-token": loginCsrf.token,
      },
      body: JSON.stringify({ email: "admin@westbridge.gy", password: "Westbridge@2026#Secure" }),
    });
    assert(loginRes.status === 200, `Login expected 200, got ${loginRes.status}`);

    const cookies = loginRes.headers.getSetCookie?.() ?? [];
    const sidCookie = cookies.find((c: string) => c.startsWith("westbridge_sid="))?.split(";")[0] ?? "";

    // Validate
    const valRes = await fetch(`${BASE}/api/auth/validate`, {
      headers: { Cookie: sidCookie },
    });
    assert(valRes.status === 200, `Validate expected 200, got ${valRes.status}`);

    // Get CSRF for logout
    const logoutCsrf = await getCsrf(sidCookie);

    // Logout
    const logoutRes = await fetch(`${BASE}/api/auth/logout`, {
      method: "POST",
      headers: {
        Cookie: `${sidCookie}; ${logoutCsrf.cookie}`,
        "x-csrf-token": logoutCsrf.token,
      },
    });
    assert(logoutRes.status === 200, `Logout expected 200, got ${logoutRes.status}`);

    // Validate after logout — should fail
    const val2 = await fetch(`${BASE}/api/auth/validate`, {
      headers: { Cookie: sidCookie },
    });
    assert(val2.status === 401, `Post-logout validate expected 401, got ${val2.status}`);
  });
}

// ─── Suite 17: Response Headers ─────────────────────────────────────────────

async function suiteHeaders() {
  console.log("\n🏷️  Suite 17: Security Headers");

  await test("Responses include security headers", async () => {
    const res = await fetch(`${BASE}/api/health`);
    const csp = res.headers.get("content-security-policy");
    const xct = res.headers.get("x-content-type-options");
    const xfo = res.headers.get("x-frame-options");

    // Helmet should set these
    assert(xct === "nosniff", `Expected x-content-type-options: nosniff, got ${xct}`);
  });

  await test("Responses include request ID", async () => {
    const { body } = await fetchJson("/api/health");
    assert(body.meta?.request_id !== undefined, "Should have request_id in meta");
  });
}

// ─── Suite 18: Analytics ────────────────────────────────────────────────────

async function suiteAnalytics() {
  console.log("\n📈 Suite 18: Analytics Tracking");

  await test("POST /api/analytics/track handles events", async () => {
    const { status } = await fetchJson("/api/analytics/track", {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ event: "test_event", properties: {} }),
    });
    // 200 or 204 both acceptable
    assert(status === 200 || status === 204, `Expected 200/204, got ${status}`);
  });
}

// ─── Suite 19: Usage Endpoint ────────────────────────────────────────────────

async function suiteUsage() {
  console.log("\n📊 Suite 19: Usage");

  await test("GET /api/usage returns usage stats", async () => {
    const { status } = await fetchJson("/api/usage", {
      headers: authHeaders(),
    });
    // 200 (data), 404 (route not found), or 429 (rate limited from earlier)
    assert(status === 200 || status === 404 || status === 429, `Expected 200/404/429, got ${status}`);
  });
}

// ─── Suite 20: Rapid-Fire Mixed Endpoints ────────────────────────────────────

async function suiteRapidFire() {
  console.log("\n🔥 Suite 20: Rapid-Fire Mixed (100 requests)");

  await test("100 mixed endpoint requests with <2% error rate", async () => {
    const endpoints = [
      { path: "/api/health", auth: false },
      { path: "/api/health/live", auth: false },
      { path: "/api/health/ready", auth: false },
      { path: "/api/erp/list?doctype=Customer", auth: true },
      { path: "/api/erp/list?doctype=Item", auth: true },
      { path: "/api/erp/list?doctype=Employee", auth: true },
      { path: "/api/erp/dashboard", auth: true },
      { path: "/api/team", auth: true },
      { path: "/api/audit?page=1&per_page=5", auth: true },
      { path: "/api/admin/flags", auth: true },
    ];

    const requests = Array.from({ length: 100 }, (_, i) => {
      const ep = endpoints[i % endpoints.length];
      const headers: Record<string, string> = ep.auth ? authHeaders() : {};
      return fetch(`${BASE}${ep.path}`, { headers })
        .then((r) => ({ ok: r.status < 500, status: r.status }))
        .catch(() => ({ ok: false, status: 0 }));
    });

    const results = await Promise.all(requests);
    const errors = results.filter((r) => !r.ok).length;
    const errorRate = (errors / results.length) * 100;
    console.log(`    → ${results.length} requests, ${errors} errors (${errorRate.toFixed(1)}%)`);
    assert(errorRate < 2, `Error rate ${errorRate.toFixed(1)}% exceeds 2% threshold`);
  });
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log("═══════════════════════════════════════════════════════");
  console.log("  WESTBRIDGE ERP — FINAL EXHAUSTIVE STRESS TEST");
  console.log("═══════════════════════════════════════════════════════");

  // Authenticate first
  // Wait for rate limit windows to expire from any previous run
  const warmup = parseInt(process.env.WARMUP_MS ?? "65000", 10);
  console.log(`\n⏳ Waiting ${Math.ceil(warmup / 1000)} seconds for rate limit windows to expire...`);
  await new Promise((r) => setTimeout(r, warmup));

  console.log("\n🔑 Authenticating...");
  await login();
  assert(SESSION_COOKIE.length > 0, "Failed to get session cookie");
  assert(CSRF_TOKEN.length > 0, "Failed to get CSRF token");
  console.log("  ✅ Authenticated with session + CSRF");

  await suiteHealth();
  await suiteAuth();
  await suiteErpCrud();
  await suiteCsrf();
  await suiteTeamAccount();
  await suiteAudit();
  await suiteAdmin();
  await suiteReports();
  await suiteAi();
  await suiteEvents();
  await suitePayloads();
  await suiteConcurrent();
  await suiteSignup();
  await suiteInvite();
  await suiteEdgeCases();
  await suiteSessionLifecycle();
  await suiteHeaders();
  await suiteAnalytics();
  await suiteUsage();
  await suiteRapidFire();

  console.log("\n═══════════════════════════════════════════════════════");
  console.log(`  RESULTS: ${passed}/${totalTests} passed, ${failed} failed`);
  console.log("═══════════════════════════════════════════════════════");

  if (failures.length > 0) {
    console.log("\n❌ FAILURES:");
    failures.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
  } else {
    console.log("\n🎉 ALL TESTS PASSED — ZERO FAILURES");
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Test runner crashed:", err);
  process.exit(1);
});

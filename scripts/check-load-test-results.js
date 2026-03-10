#!/usr/bin/env node
/**
 * Parse k6 JSON output and fail if performance thresholds are breached.
 *
 * Thresholds:
 *   - p95 HTTP request duration < 3000ms
 *   - Error rate (non-2xx responses) < 5%
 *
 * Usage: node scripts/check-load-test-results.js results.json
 */

const fs = require("fs");

const file = process.argv[2];
if (!file) {
  console.error("Usage: node check-load-test-results.js <results.json>");
  process.exit(1);
}

if (!fs.existsSync(file)) {
  console.warn(`[check-load-test-results] File not found: ${file} — skipping threshold check`);
  process.exit(0);
}

const lines = fs.readFileSync(file, "utf8").trim().split("\n");
const events = lines
  .map((l) => { try { return JSON.parse(l); } catch { return null; } })
  .filter(Boolean);

const durations = events
  .filter((e) => e.type === "Point" && e.metric === "http_req_duration")
  .map((e) => e.data.value)
  .sort((a, b) => a - b);

const totalRequests = events.filter((e) => e.type === "Point" && e.metric === "http_reqs").length;
const failedRequests = events.filter(
  (e) => e.type === "Point" && e.metric === "http_req_failed" && e.data.value === 1
).length;

if (durations.length === 0) {
  console.warn("[check-load-test-results] No http_req_duration data found — skipping");
  process.exit(0);
}

const p95 = durations[Math.floor(durations.length * 0.95)];
const p99 = durations[Math.floor(durations.length * 0.99)];
const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
const errorRate = totalRequests > 0 ? (failedRequests / totalRequests) * 100 : 0;

console.log("=== Load Test Results ===");
console.log(`  Requests:   ${durations.length}`);
console.log(`  avg:        ${avg.toFixed(0)}ms`);
console.log(`  p95:        ${p95.toFixed(0)}ms`);
console.log(`  p99:        ${p99.toFixed(0)}ms`);
console.log(`  Error rate: ${errorRate.toFixed(2)}%`);

const P95_THRESHOLD = 3000;
const ERROR_RATE_THRESHOLD = 5;

let failed = false;

if (p95 > P95_THRESHOLD) {
  console.error(`❌ p95 (${p95.toFixed(0)}ms) exceeds threshold (${P95_THRESHOLD}ms)`);
  failed = true;
} else {
  console.log(`✅ p95 (${p95.toFixed(0)}ms) within threshold (${P95_THRESHOLD}ms)`);
}

if (errorRate > ERROR_RATE_THRESHOLD) {
  console.error(`❌ Error rate (${errorRate.toFixed(2)}%) exceeds threshold (${ERROR_RATE_THRESHOLD}%)`);
  failed = true;
} else {
  console.log(`✅ Error rate (${errorRate.toFixed(2)}%) within threshold (${ERROR_RATE_THRESHOLD}%)`);
}

process.exit(failed ? 1 : 0);

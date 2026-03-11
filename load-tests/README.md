# Load Tests

Performance and load tests for the Westbridge ERP backend, built with [k6](https://k6.io/).

## Prerequisites

### Install k6

**macOS (Homebrew):**

```bash
brew install k6
```

**Debian / Ubuntu:**

```bash
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
  --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" \
  | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6
```

**Windows (Chocolatey):**

```bash
choco install k6
```

**Docker:**

```bash
docker pull grafana/k6
```

Verify your installation:

```bash
k6 version
```

## Test Files

| File               | Purpose                                    | VUs   | Duration   |
| ------------------ | ------------------------------------------ | ----- | ---------- |
| `smoke.js`         | Quick sanity check (health endpoints only) | 1     | 30s        |
| `average-load.js`  | Simulates normal daily traffic patterns    | 50    | ~8 min     |
| `stress.js`        | Pushes system beyond normal capacity       | 200   | ~18 min    |
| `spike.js`         | Sudden traffic burst and recovery          | 300   | ~4 min     |

Supporting files:

- `config.js` -- shared configuration (base URL, think time)
- `helpers.js` -- shared helper functions (auth, CSRF, random doctype picker)

## Running Tests

Start the backend server before running any load tests:

```bash
npm run dev
```

### Using npm scripts

```bash
# Quick smoke test (run first to verify the setup works)
npm run test:load:smoke

# Normal traffic simulation
npm run test:load

# Stress test (high load)
npm run test:load:stress

# Spike test (sudden burst)
npm run test:load:spike
```

### Using k6 directly

```bash
k6 run load-tests/smoke.js
```

### Targeting a different environment

Override the base URL via the `BASE_URL` environment variable:

```bash
k6 run -e BASE_URL=https://staging.example.com load-tests/average-load.js
```

### Providing test credentials

The login-based scenarios require valid credentials. Set them via environment variables:

```bash
k6 run \
  -e LOAD_TEST_EMAIL=testuser@example.com \
  -e LOAD_TEST_PASSWORD=SecurePass123 \
  load-tests/average-load.js
```

Default credentials (if not set): `loadtest@example.com` / `Test1234!`

### Running with Docker

```bash
docker run --rm -i \
  -v "$(pwd)/load-tests:/load-tests" \
  -e BASE_URL=http://host.docker.internal:4000 \
  grafana/k6 run /load-tests/smoke.js
```

## Scenarios (average-load, stress, spike)

All three multi-scenario tests use the same weighted distribution:

| Scenario         | Weight | Endpoints hit                            |
| ---------------- | ------ | ---------------------------------------- |
| Health check     | 10%    | `GET /api/health/live`                   |
| Login attempt    | 20%    | `GET /api/csrf` + `POST /api/auth/login` |
| CSRF token fetch | 15%    | `GET /api/csrf`                          |
| ERP list         | 30%    | Login flow + `GET /api/erp/list`         |
| ERP doc fetch    | 25%    | Login flow + `GET /api/erp/list` + `GET /api/erp/doc` |

## Thresholds

Each test defines its own pass/fail thresholds:

| Test         | p(95) latency | p(99) latency | Error rate |
| ------------ | ------------- | ------------- | ---------- |
| smoke        | < 500ms       | --            | < 1%       |
| average-load | < 500ms       | < 1500ms      | < 1%       |
| stress       | < 2000ms      | --            | < 5%       |
| spike        | < 3000ms      | --            | < 10%      |

k6 will exit with a non-zero code if any threshold is breached.

## Interpreting Results

After each run, k6 prints a summary including:

- **http_req_duration** -- response time distribution (min, med, avg, p90, p95, p99, max)
- **http_req_failed** -- percentage of failed requests
- **http_reqs** -- total number of requests and requests per second
- **iteration_duration** -- time per VU iteration
- **vus** -- concurrent virtual users over time
- **checks** -- pass/fail counts for assertions

Look for:

- Rising p95/p99 latencies as load increases (saturation point)
- Increasing error rates under stress (breaking point)
- Recovery behavior after a spike (should return to baseline)
- Rate-limiting responses (HTTP 429) under heavy load

## Tips

- Always run the smoke test first to verify connectivity.
- Create a dedicated load-test user account -- do not use real credentials.
- Run load tests against staging, not production, unless you have explicit approval.
- Monitor server-side metrics (CPU, memory, DB connections) alongside k6 output.
- Use `k6 run --out json=results.json` to export raw metrics for further analysis.

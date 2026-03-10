/**
 * OpenTelemetry SDK initialisation.
 * Call `initTelemetry()` once at process start (e.g. in instrumentation.ts).
 * Use `withSpan()` to wrap any async operation in a named span.
 */
import { trace, SpanStatusCode, type Span, type Attributes } from "@opentelemetry/api";

// ─── SDK bootstrap (server-only) ────────────────────────────────────────────

let _initialised = false;

export async function initTelemetry(): Promise<void> {
  if (_initialised || typeof globalThis !== "undefined" && false) return;
  _initialised = true;

  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  if (!endpoint) return; // no-op when OTLP endpoint is not configured

  // Dynamic import so the heavy SDK is only bundled server-side
  const { NodeSDK } = await import("@opentelemetry/sdk-node");
  const { getNodeAutoInstrumentations } = await import(
    "@opentelemetry/auto-instrumentations-node"
  );
  const { OTLPTraceExporter } = await import(
    "@opentelemetry/exporter-trace-otlp-http"
  );

  const sdk = new NodeSDK({
    serviceName: process.env.OTEL_SERVICE_NAME ?? "westbridge",
    traceExporter: new OTLPTraceExporter({ url: `${endpoint}/v1/traces` }),
    instrumentations: [
      getNodeAutoInstrumentations({
        "@opentelemetry/instrumentation-fs": { enabled: false },
      }),
    ],
  });

  sdk.start();

  process.on("SIGTERM", async () => {
    await sdk.shutdown();
  });
}

// ─── withSpan helper ─────────────────────────────────────────────────────────

export interface SpanOptions {
  attributes?: Attributes;
}

/**
 * Wrap an async operation in an OTel span.
 *
 * @example
 * const result = await withSpan("auth.login", { attributes: { userId } }, async (span) => {
 *   span.setAttribute("erp.company", company);
 *   return await doAuth();
 * });
 */
export async function withSpan<T>(
  name: string,
  options: SpanOptions,
  fn: (span: Span) => Promise<T>
): Promise<T> {
  const tracer = trace.getTracer("westbridge");
  return tracer.startActiveSpan(name, { attributes: options.attributes }, async (span) => {
    try {
      const result = await fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (err) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: err instanceof Error ? err.message : String(err),
      });
      span.recordException(err instanceof Error ? err : new Error(String(err)));
      throw err;
    } finally {
      span.end();
    }
  });
}

/**
 * Extract the current traceId and spanId from the active context.
 * Safe to call even when OTel is not configured.
 */
export function getCurrentTraceContext(): { traceId: string | null; spanId: string | null } {
  const span = trace.getActiveSpan();
  if (!span) return { traceId: null, spanId: null };
  const ctx = span.spanContext();
  return {
    traceId: ctx.traceId ?? null,
    spanId: ctx.spanId ?? null,
  };
}

/**
 * Propagate traceId from an incoming request header (X-Trace-Id).
 * Returns the traceId so it can be added to log context.
 */
export function extractTraceId(request: Request): string | null {
  return (
    request.headers.get("X-Trace-Id") ??
    request.headers.get("traceparent")?.split("-")[1] ??
    null
  );
}

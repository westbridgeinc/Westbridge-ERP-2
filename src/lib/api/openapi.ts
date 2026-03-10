/**
 * OpenAPI 3.1 spec generator.
 * Generates the spec from registered route schemas using @asteasolutions/zod-to-openapi.
 * Served at GET /api/docs.
 */
import { OpenAPIRegistry, OpenApiGeneratorV31 } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

export const registry = new OpenAPIRegistry();

// ─── Common schemas ───────────────────────────────────────────────────────────

const ErrorSchema = registry.register(
  "Error",
  z.object({
    ok: z.literal(false),
    error: z.object({
      code: z.string(),
      message: z.string(),
    }),
  })
);

const SuccessSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({ ok: z.literal(true), data: dataSchema });

// ─── Auth routes ──────────────────────────────────────────────────────────────

const LoginBodySchema = registry.register(
  "LoginBody",
  z.object({
    email: z.string().email(),
    password: z.string().min(1),
  })
);

const LoginResponseSchema = registry.register(
  "LoginResponse",
  SuccessSchema(z.object({ userId: z.string(), accountId: z.string(), role: z.string() }))
);

registry.registerPath({
  method: "post",
  path: "/api/auth/login",
  tags: ["Authentication"],
  summary: "Log in with email and password",
  request: { body: { content: { "application/json": { schema: LoginBodySchema } } } },
  responses: {
    200: { description: "Login successful", content: { "application/json": { schema: LoginResponseSchema } } },
    401: { description: "Invalid credentials", content: { "application/json": { schema: ErrorSchema } } },
    429: { description: "Rate limited", content: { "application/json": { schema: ErrorSchema } } },
  },
});

const ForgotPasswordBodySchema = registry.register(
  "ForgotPasswordBody",
  z.object({ email: z.string().email() })
);

registry.registerPath({
  method: "post",
  path: "/api/auth/forgot-password",
  tags: ["Authentication"],
  summary: "Request a password reset email",
  request: { body: { content: { "application/json": { schema: ForgotPasswordBodySchema } } } },
  responses: {
    200: { description: "Always returns 200 (prevents enumeration)" },
  },
});

// ─── ERP routes ───────────────────────────────────────────────────────────────

registry.registerPath({
  method: "get",
  path: "/api/erp/list",
  tags: ["ERP"],
  summary: "List ERP documents",
  security: [{ cookieAuth: [] }],
  request: {
    query: z.object({
      doctype: z.string(),
      limit: z.string().optional(),
      offset: z.string().optional(),
      order_by: z.string().optional(),
      filters: z.string().optional(),
    }),
  },
  responses: {
    200: { description: "Document list" },
    401: { description: "Unauthenticated", content: { "application/json": { schema: ErrorSchema } } },
    400: { description: "Bad request", content: { "application/json": { schema: ErrorSchema } } },
  },
});

// ─── Health routes ────────────────────────────────────────────────────────────

registry.registerPath({
  method: "get",
  path: "/api/health",
  tags: ["Operations"],
  summary: "Comprehensive health check",
  responses: {
    200: { description: "Healthy or degraded" },
    503: { description: "Unhealthy (critical dependency down)" },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/health/ready",
  tags: ["Operations"],
  summary: "Readiness probe — all critical dependencies up",
  responses: { 200: { description: "Ready" }, 503: { description: "Not ready" } },
});

registry.registerPath({
  method: "get",
  path: "/api/health/live",
  tags: ["Operations"],
  summary: "Liveness probe — process is alive",
  responses: { 200: { description: "Alive" } },
});

// ─── Spec generation ──────────────────────────────────────────────────────────

export function generateOpenApiSpec() {
  const generator = new OpenApiGeneratorV31(registry.definitions);
  return generator.generateDocument({
    openapi: "3.1.0",
    info: {
      title: "Westbridge API",
      version: "1.0.0",
      description: "Enterprise ERP SaaS platform API",
    },
    servers: [{ url: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000" }],
  });
}

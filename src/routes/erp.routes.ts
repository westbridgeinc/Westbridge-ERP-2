import { Router, Request, Response } from "express";
import { list } from "../lib/services/erp.service.js";
import { logAudit, auditContext } from "../lib/services/audit.service.js";
import { validateErpFilters } from "../lib/validation/erp-filters.js";
import { apiSuccess, apiError, apiMeta, getRequestId } from "../types/api.js";
import { checkTieredRateLimit, checkErpAccountRateLimit, getClientIdentifier, rateLimitHeaders } from "../lib/api/rate-limit-tiers.js";
import { requireAuth } from "../middleware/auth.js";
import * as Sentry from "@sentry/node";
import { prisma } from "../lib/data/prisma.js";
import { ALLOWED_DOCTYPES_SET } from "../lib/erp-constants.js";
import { getDoc, createDoc, updateDoc, deleteDoc } from "../lib/services/erp.service.js";
import { erpDocCreateBodySchema } from "../types/schemas/erp.js";
import { validateCsrf, CSRF_COOKIE_NAME } from "../lib/csrf.js";
import { reportSecurityEvent } from "../lib/security-monitor.js";
import { validateSession } from "../lib/services/session.service.js";
import { COOKIE } from "../lib/constants.js";

const router = Router();

const MAX_BODY_BYTES = 1_048_576;

// ─── Interfaces for dashboard ──────────────────────────────────────────────────

interface RevenuePoint { month: string; value: number }
interface ActivityItem { text: string; time: string; type: "success" | "error" | "info" | "default" }

interface DashboardPayload {
  revenueMTD: number;
  revenueChange: number;
  outstandingCount: number;
  openDealsCount: number;
  employeeCount: number;
  employeeDelta: number;
  revenueData: RevenuePoint[];
  activity: ActivityItem[];
  /** True when ERP is unreachable and the response contains sample data, not live data. */
  isDemo?: boolean;
}

// ─── Demo / fallback data ─────────────────────────────────────────────────────
const DEMO_DATA: DashboardPayload = {
  revenueMTD: 48250,
  revenueChange: 12,
  outstandingCount: 7,
  openDealsCount: 14,
  employeeCount: 23,
  employeeDelta: 2,
  revenueData: [
    { month: "Sep", value: 1.8 },
    { month: "Oct", value: 2.1 },
    { month: "Nov", value: 2.4 },
    { month: "Dec", value: 1.9 },
    { month: "Jan", value: 3.1 },
    { month: "Feb", value: 3.4 },
  ],
  activity: [
    { text: "Invoice #SI-00041 paid — $4,200", time: "2h ago", type: "success" },
    { text: "New sales order from Massy Distribution", time: "4h ago", type: "info" },
    { text: "Purchase order approved — $12,500", time: "6h ago", type: "success" },
    { text: "Payroll run completed for 23 employees", time: "1d ago", type: "success" },
    { text: "Invoice #SI-00039 overdue — $1,800", time: "2d ago", type: "error" },
  ],
  isDemo: true,
};

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatRelativeTime(dateStr: string): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ─── Real data aggregation ────────────────────────────────────────────────────

async function buildDashboardData(
  sessionId: string,
  accountId: string,
  erpnextCompany: string | null
): Promise<DashboardPayload> {
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .slice(0, 10);

  // Parallel ERP fetches — any individual failure falls back gracefully
  const [invoicesRes, ordersRes, employeesRes] = await Promise.allSettled([
    list("Sales Invoice", sessionId, { limit_page_length: "100" }, accountId, erpnextCompany),
    list("Sales Order", sessionId, { limit_page_length: "50", filters: JSON.stringify([["Sales Order", "status", "in", ["Draft", "To Deliver and Bill", "To Bill", "To Deliver"]]]) }, accountId, erpnextCompany),
    list("Employee", sessionId, { limit_page_length: "100", fields: JSON.stringify(["name", "date_of_joining", "status"]) }, accountId, erpnextCompany),
  ]);

  // If all three calls failed, bail out to demo data
  const anySucceeded = [invoicesRes, ordersRes, employeesRes].some((r) => r.status === "fulfilled" && r.value.ok);
  if (!anySucceeded) return DEMO_DATA;

  // Revenue MTD — sum paid invoices this month
  const invoices = invoicesRes.status === "fulfilled" && invoicesRes.value.ok
    ? (invoicesRes.value.data as Record<string, unknown>[])
    : [];

  let revenueMTD = 0;
  let outstandingCount = 0;

  for (const inv of invoices) {
    const status = String(inv.status ?? "");
    const postingDate = String(inv.posting_date ?? "");
    const grandTotal = Number(inv.grand_total ?? 0);

    if (status === "Paid" && postingDate >= firstOfMonth) {
      revenueMTD += grandTotal;
    }
    if (status === "Unpaid" || status === "Overdue") {
      outstandingCount++;
    }
  }

  // 6-month revenue trend
  const revenueByMonth: Record<string, number> = {};
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    revenueByMonth[`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`] = 0;
  }
  for (const inv of invoices) {
    if (String(inv.status ?? "") !== "Paid") continue;
    const month = String(inv.posting_date ?? "").slice(0, 7);
    if (month in revenueByMonth) {
      revenueByMonth[month] += Number(inv.grand_total ?? 0);
    }
  }
  const revenueData: RevenuePoint[] = Object.entries(revenueByMonth).map(([key, val]) => {
    const [, m] = key.split("-");
    return { month: MONTH_LABELS[parseInt(m, 10) - 1], value: parseFloat((val / 1_000_000).toFixed(2)) };
  });

  // Revenue change (last month vs month before)
  const monthValues = Object.values(revenueByMonth);
  const prevMonth = monthValues[monthValues.length - 2] ?? 0;
  const currMonth = monthValues[monthValues.length - 1] ?? 0;
  const revenueChange = prevMonth > 0
    ? Math.round(((currMonth - prevMonth) / prevMonth) * 100)
    : 0;

  // Open sales orders
  const openDealsCount =
    ordersRes.status === "fulfilled" && ordersRes.value.ok
      ? (ordersRes.value.data as unknown[]).length
      : DEMO_DATA.openDealsCount;

  // Employee count (active employees only)
  const employees =
    employeesRes.status === "fulfilled" && employeesRes.value.ok
      ? (employeesRes.value.data as Record<string, unknown>[])
      : [];
  const activeEmployees = employees.filter((e) => String(e.status ?? "") !== "Left");
  const employeeCount = activeEmployees.length || DEMO_DATA.employeeCount;

  // Delta: employees who joined this month
  const employeeDelta = activeEmployees.filter((e) => {
    const joined = String(e.date_of_joining ?? "");
    return joined >= firstOfMonth;
  }).length;

  // Activity feed — recent invoices + orders
  const activityItems: ActivityItem[] = [];
  for (const inv of invoices.slice(0, 8)) {
    const status = String(inv.status ?? "");
    if (status === "Paid") {
      activityItems.push({
        text: `Invoice ${String(inv.name ?? "")} paid — $${Number(inv.grand_total ?? 0).toLocaleString()}`,
        time: formatRelativeTime(String(inv.modified ?? inv.creation ?? "")),
        type: "success",
      });
    } else if (status === "Overdue") {
      activityItems.push({
        text: `Invoice ${String(inv.name ?? "")} overdue — $${Number(inv.outstanding_amount ?? inv.grand_total ?? 0).toLocaleString()}`,
        time: formatRelativeTime(String(inv.modified ?? inv.creation ?? "")),
        type: "error",
      });
    }
  }

  // isDemo is true if any metric fell back to DEMO_DATA values
  const usingDemoActivity = activityItems.length === 0;
  const usingDemoOrders = !(ordersRes.status === "fulfilled" && ordersRes.value.ok);
  const usingDemoEmployees = activeEmployees.length === 0;
  const isDemo = usingDemoActivity || usingDemoOrders || usingDemoEmployees;

  return {
    revenueMTD,
    revenueChange,
    outstandingCount,
    openDealsCount,
    employeeCount,
    employeeDelta,
    revenueData,
    activity: activityItems.length > 0 ? activityItems.slice(0, 5) : DEMO_DATA.activity,
    isDemo,
  };
}

// ─── GET /erp/list ─────────────────────────────────────────────────────────────

router.get("/erp/list", requireAuth, async (req: Request, res: Response) => {
  const start = Date.now();
  const requestId = getRequestId(req as any);
  const meta = () => apiMeta({ request_id: requestId });
  const responseHeaders = () => ({ "X-Response-Time": `${Date.now() - start}ms`, "Cache-Control": "private, no-cache, no-store, must-revalidate", "Vary": "Accept-Encoding, Accept" });

  try {
    const session = (req as any).session;
    const rateLimit = await checkTieredRateLimit(getClientIdentifier(req as any), "authenticated", "/api/erp/list");
    if (!rateLimit.allowed) {
      res.set({ ...responseHeaders(), ...rateLimitHeaders(rateLimit) });
      return res.status(429).json(
        apiError("RATE_LIMIT", "Too many requests. Try again in a minute.", undefined, meta())
      );
    }
    const erpAccountLimit = await checkErpAccountRateLimit(session.accountId);
    if (!erpAccountLimit.allowed) {
      res.set({ ...responseHeaders(), ...rateLimitHeaders(erpAccountLimit) });
      return res.status(429).json(
        apiError("RATE_LIMIT", "Too many ERP requests for this account. Try again in a minute.", undefined, meta())
      );
    }
    const ctx = auditContext(req as any);
    const { accountId, erpnextSid } = session;
    if (!erpnextSid) {
      res.set(responseHeaders());
      return res.status(401).json(
        apiError("UNAUTHORIZED", "ERP session not available. Please log in again.", undefined, meta())
      );
    }
    const sid = erpnextSid;

    const doctype = req.query.doctype as string | undefined;
    if (!doctype) {
      res.set(responseHeaders());
      return res.status(400).json(
        apiError("BAD_REQUEST", "doctype required", undefined, meta())
      );
    }
    if (!ALLOWED_DOCTYPES_SET.has(doctype)) {
      res.set(responseHeaders());
      return res.status(400).json(
        apiError("BAD_REQUEST", "Invalid or unsupported document type", undefined, meta())
      );
    }

    const ORDER_BY_ALLOWLIST = new Set([
      "creation desc", "creation asc", "modified desc", "modified asc",
      "name desc", "name asc", "posting_date desc", "posting_date asc",
      "grand_total desc", "grand_total asc", "status desc", "status asc",
    ]);
    const rawOrderBy = (req.query.order_by as string) ?? "creation desc";
    const orderBy = ORDER_BY_ALLOWLIST.has(rawOrderBy.toLowerCase()) ? rawOrderBy : "creation desc";
    const pageSize = Math.min(50, Math.max(1, parseInt((req.query.limit as string) ?? "20", 10) || 20));
    const rawPage = (req.query.page as string) ?? "0";
    const pageNum = parseInt(rawPage, 10);
    if (Number.isNaN(pageNum) || pageNum < 0 || !Number.isInteger(pageNum)) {
      res.set(responseHeaders());
      return res.status(400).json(
        apiError("BAD_REQUEST", "page must be a non-negative integer", undefined, meta())
      );
    }
    const MAX_PAGE = 10_000;
    if (pageNum > MAX_PAGE) {
      res.set(responseHeaders());
      return res.status(400).json(
        apiError("BAD_REQUEST", `Page number exceeds maximum (${MAX_PAGE})`, undefined, meta())
      );
    }
    const page = pageNum;
    const limit_start = page * pageSize;
    const fields = req.query.fields as string | undefined;
    const filtersParam = req.query.filters as string | undefined;

    const filtersResult = validateErpFilters(filtersParam);
    if (!filtersResult.ok) {
      res.set(responseHeaders());
      return res.status(400).json(
        apiError("BAD_REQUEST", String(filtersResult.error ?? "Invalid filters"), undefined, meta())
      );
    }

    const params: Record<string, string> = {
      limit_page_length: String(pageSize),
      limit_start: String(limit_start),
      order_by: orderBy,
    };
    if (fields) params.fields = JSON.stringify(fields.split(",").map((f) => f.trim()));
    if (filtersResult.filters && filtersResult.filters.length > 0) params.filters = JSON.stringify(filtersResult.filters);

    const account = await prisma.account.findUnique({ where: { id: accountId }, select: { erpnextCompany: true } }).catch(() => null);
    const result = await list(doctype, sid, params, accountId ?? undefined, account?.erpnextCompany);
    if (!result.ok) {
      const status = result.error === "doctype required" ? 400 : 502;
      res.set(responseHeaders());
      return res.status(status).json(
        apiError("ERP_ERROR", result.error, undefined, meta())
      );
    }
    void logAudit({
      accountId: session.accountId,
      userId: session.userId,
      action: "erp.list.read",
      resource: doctype,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      severity: "info",
      outcome: "success",
    });
    const hasMore = Array.isArray(result.data) && result.data.length === pageSize;
    res.set(responseHeaders());
    return res.json(
      apiSuccess(result.data, { ...meta(), page, pageSize, hasMore })
    );
  } catch (error) {
    Sentry.captureException(error, { extra: { request_id: requestId } });
    res.set({ "X-Response-Time": `${Date.now() - start}ms` });
    return res.status(500).json(
      apiError("SERVER_ERROR", "An unexpected error occurred", undefined, meta())
    );
  }
});

// ─── GET /erp/doc ──────────────────────────────────────────────────────────────

router.get("/erp/doc", requireAuth, async (req: Request, res: Response) => {
  const start = Date.now();
  const requestId = getRequestId(req as any);
  const meta = () => apiMeta({ request_id: requestId });
  const responseHeaders = () => ({ "X-Response-Time": `${Date.now() - start}ms` });

  try {
    const session = (req as any).session;
    if (!session.erpnextSid) {
      res.set(responseHeaders());
      return res.status(401).json(apiError("UNAUTHORIZED", "ERP session not available. Please log in again.", undefined, meta()));
    }
    const ctx = auditContext(req as any);
    const rateLimitGet = await checkTieredRateLimit(getClientIdentifier(req as any), "authenticated", "/api/erp/doc");
    if (!rateLimitGet.allowed) {
      res.set({ ...responseHeaders(), ...rateLimitHeaders(rateLimitGet) });
      return res.status(429).json(
        apiError("RATE_LIMIT", "Too many requests. Try again in a minute.", undefined, meta())
      );
    }

    const ALLOWED_DOCTYPES = new Set([
      "Sales Invoice", "Sales Order", "Purchase Invoice", "Purchase Order",
      "Quotation", "Customer", "Supplier", "Item", "Employee",
      "Journal Entry", "Payment Entry", "Stock Entry", "Expense Claim",
      "Leave Application", "Salary Slip", "BOM",
    ]);

    const doctype = req.query.doctype as string | undefined;
    const name = req.query.name as string | undefined;
    if (!doctype || !name) {
      res.set(responseHeaders());
      return res.status(400).json(
        apiError("BAD_REQUEST", "doctype and name required", undefined, meta())
      );
    }
    if (!ALLOWED_DOCTYPES.has(doctype)) {
      res.set(responseHeaders());
      return res.status(400).json(
        apiError("BAD_REQUEST", "Invalid or unsupported document type", undefined, meta())
      );
    }

    const result = await getDoc(doctype, name, session.erpnextSid as string, session.accountId);
    if (!result.ok) {
      const status = result.error === "Not found" ? 404 : 502;
      res.set(responseHeaders());
      return res.status(status).json(
        apiError("ERP_ERROR", result.error, undefined, meta())
      );
    }
    void logAudit({
      accountId: session.accountId,
      userId: session.userId,
      action: "erp.doc.read",
      resource: doctype,
      resourceId: name,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      severity: "info",
      outcome: "success",
    });
    res.set(responseHeaders());
    return res.json(apiSuccess(result.data, meta()));
  } catch (error) {
    Sentry.captureException(error, { extra: { request_id: requestId } });
    return res.status(500).json(
      apiError("SERVER_ERROR", "An unexpected error occurred", undefined, apiMeta({ request_id: requestId }))
    );
  }
});

// ─── POST /erp/doc ─────────────────────────────────────────────────────────────

router.post("/erp/doc", requireAuth, async (req: Request, res: Response) => {
  const start = Date.now();
  const requestId = getRequestId(req as any);
  const meta = () => apiMeta({ request_id: requestId });
  const responseHeaders = () => ({ "X-Response-Time": `${Date.now() - start}ms` });

  try {
    const contentLength = parseInt(req.headers["content-length"] as string ?? "0", 10);
    if (contentLength > MAX_BODY_BYTES) {
      res.set(responseHeaders());
      return res.status(413).json(
        apiError("PAYLOAD_TOO_LARGE", "Request body exceeds 1MB limit", undefined, meta())
      );
    }

    const session = (req as any).session;
    const ctx = auditContext(req as any);

    // CSRF must be validated before any business logic (including ERP session check)
    const csrfCookie = req.cookies[CSRF_COOKIE_NAME];
    const csrfHeader = req.headers["x-csrf-token"] as string ?? req.headers["X-CSRF-Token"] as string;
    if (!validateCsrf(csrfHeader, csrfCookie)) {
      void logAudit({
        accountId: session.accountId,
        userId: session.userId,
        action: "erp.doc.create.csrf_failed",
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        severity: "warn",
        outcome: "failure",
      });
      reportSecurityEvent({
        type: "csrf_attack",
        userId: session.userId,
        accountId: session.accountId,
        ipAddress: ctx.ipAddress,
        details: "CSRF validation failed on erp.doc.create",
      });
      res.set(responseHeaders());
      return res.status(403).json(
        apiError("FORBIDDEN", "Invalid or missing CSRF token.", undefined, meta())
      );
    }

    if (!session.erpnextSid) {
      res.set(responseHeaders());
      return res.status(401).json(apiError("UNAUTHORIZED", "ERP session not available. Please log in again.", undefined, meta()));
    }

    const rateLimitPost = await checkTieredRateLimit(getClientIdentifier(req as any), "authenticated", "/api/erp/doc");
    if (!rateLimitPost.allowed) {
      res.set({ ...responseHeaders(), ...rateLimitHeaders(rateLimitPost) });
      return res.status(429).json(
        apiError("RATE_LIMIT", "Too many requests. Try again in a minute.", undefined, meta())
      );
    }

    const body = req.body;

    const parsed = erpDocCreateBodySchema.safeParse(body);
    if (!parsed.success) {
      const first = parsed.error.flatten().fieldErrors;
      const message = (first.doctype as string[])?.[0] ?? "Invalid request";
      res.set(responseHeaders());
      return res.status(400).json(
        apiError("VALIDATION_ERROR", message, undefined, meta())
      );
    }

    const FORBIDDEN_FIELDS = new Set([
      "docstatus", "owner", "modified_by", "creation", "modified",
      "idx", "parent", "parentfield", "parenttype", "amended_from",
    ]);
    const { doctype, ...rawData } = parsed.data as { doctype: string; [k: string]: unknown };
    const data = Object.fromEntries(
      Object.entries(rawData).filter(([k]) => !FORBIDDEN_FIELDS.has(k))
    );
    const ALLOWED_DOCTYPES_POST = new Set([
      "Sales Invoice", "Sales Order", "Purchase Invoice", "Purchase Order",
      "Quotation", "Customer", "Supplier", "Item", "Employee",
      "Journal Entry", "Payment Entry", "Stock Entry", "Expense Claim",
      "Leave Application", "Salary Slip", "BOM",
    ]);
    if (!ALLOWED_DOCTYPES_POST.has(doctype)) {
      res.set(responseHeaders());
      return res.status(400).json(
        apiError("BAD_REQUEST", "Invalid or unsupported document type", undefined, meta())
      );
    }
    const result = await createDoc(doctype, session.erpnextSid as string, data as Record<string, unknown>, session.accountId);
    if (!result.ok) {
      res.set(responseHeaders());
      return res.status(502).json(
        apiError("ERP_ERROR", result.error, undefined, meta())
      );
    }
    const created = result.data as { name?: string };
    void logAudit({
      accountId: session.accountId,
      userId: session.userId,
      action: "erp.doc.create",
      resource: doctype,
      resourceId: created?.name ?? undefined,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      severity: "info",
      outcome: "success",
    });
    // Meter billable doc creation — fire-and-forget
    const { meter } = await import("../lib/metering.js");
    meter.increment(session.accountId, "erp_docs_created").catch(() => {});
    res.set(responseHeaders());
    return res.json(apiSuccess(result.data, meta()));
  } catch (error) {
    Sentry.captureException(error, { extra: { request_id: requestId } });
    return res.status(500).json(
      apiError("SERVER_ERROR", "An unexpected error occurred", undefined, meta())
    );
  }
});

// ─── PUT /erp/doc ──────────────────────────────────────────────────────────────

router.put("/erp/doc", requireAuth, async (req: Request, res: Response) => {
  const start = Date.now();
  const requestId = getRequestId(req as any);
  const meta = () => apiMeta({ request_id: requestId });
  const responseHeaders = () => ({ "X-Response-Time": `${Date.now() - start}ms` });

  try {
    const contentLength = parseInt(req.headers["content-length"] as string ?? "0", 10);
    if (contentLength > MAX_BODY_BYTES) {
      res.set(responseHeaders());
      return res.status(413).json(
        apiError("PAYLOAD_TOO_LARGE", "Request body exceeds 1MB limit", undefined, meta())
      );
    }

    const session = (req as any).session;
    const ctx = auditContext(req as any);

    // CSRF must be validated before any business logic
    const csrfCookie = req.cookies[CSRF_COOKIE_NAME];
    const csrfHeader = req.headers["x-csrf-token"] as string ?? req.headers["X-CSRF-Token"] as string;
    if (!validateCsrf(csrfHeader, csrfCookie)) {
      void logAudit({
        accountId: session.accountId,
        userId: session.userId,
        action: "erp.doc.update.csrf_failed",
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        severity: "warn",
        outcome: "failure",
      });
      reportSecurityEvent({
        type: "csrf_attack",
        userId: session.userId,
        accountId: session.accountId,
        ipAddress: ctx.ipAddress,
        details: "CSRF validation failed on erp.doc.update",
      });
      res.set(responseHeaders());
      return res.status(403).json(
        apiError("FORBIDDEN", "Invalid or missing CSRF token.", undefined, meta())
      );
    }

    if (!session.erpnextSid) {
      res.set(responseHeaders());
      return res.status(401).json(apiError("UNAUTHORIZED", "ERP session not available. Please log in again.", undefined, meta()));
    }

    const rateLimitPut = await checkTieredRateLimit(getClientIdentifier(req as any), "authenticated", "/api/erp/doc");
    if (!rateLimitPut.allowed) {
      res.set({ ...responseHeaders(), ...rateLimitHeaders(rateLimitPut) });
      return res.status(429).json(
        apiError("RATE_LIMIT", "Too many requests. Try again in a minute.", undefined, meta())
      );
    }

    const body = req.body;

    const parsed = erpDocCreateBodySchema.safeParse(body);
    if (!parsed.success) {
      const first = parsed.error.flatten().fieldErrors;
      const message = (first.doctype as string[])?.[0] ?? "Invalid request";
      res.set(responseHeaders());
      return res.status(400).json(
        apiError("VALIDATION_ERROR", message, undefined, meta())
      );
    }

    const FORBIDDEN_FIELDS = new Set([
      "docstatus", "owner", "modified_by", "creation", "modified",
      "idx", "parent", "parentfield", "parenttype", "amended_from",
    ]);
    const { doctype, name, ...rawData } = parsed.data as { doctype: string; name: string; [k: string]: unknown };
    const data = Object.fromEntries(
      Object.entries(rawData).filter(([k]) => !FORBIDDEN_FIELDS.has(k))
    );

    if (!name) {
      res.set(responseHeaders());
      return res.status(400).json(
        apiError("BAD_REQUEST", "name is required for update", undefined, meta())
      );
    }

    const ALLOWED_DOCTYPES_PUT = new Set([
      "Sales Invoice", "Sales Order", "Purchase Invoice", "Purchase Order",
      "Quotation", "Customer", "Supplier", "Item", "Employee",
      "Journal Entry", "Payment Entry", "Stock Entry", "Expense Claim",
      "Leave Application", "Salary Slip", "BOM",
    ]);
    if (!ALLOWED_DOCTYPES_PUT.has(doctype)) {
      res.set(responseHeaders());
      return res.status(400).json(
        apiError("BAD_REQUEST", "Invalid or unsupported document type", undefined, meta())
      );
    }

    const result = await updateDoc(doctype, name, session.erpnextSid as string, data as Record<string, unknown>, session.accountId);
    if (!result.ok) {
      res.set(responseHeaders());
      return res.status(502).json(
        apiError("ERP_ERROR", result.error, undefined, meta())
      );
    }
    void logAudit({
      accountId: session.accountId,
      userId: session.userId,
      action: "erp.doc.update",
      resource: doctype,
      resourceId: name,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      severity: "info",
      outcome: "success",
    });
    // Meter billable doc update — fire-and-forget
    const { meter } = await import("../lib/metering.js");
    meter.increment(session.accountId, "erp_docs_created").catch(() => {});
    res.set(responseHeaders());
    return res.json(apiSuccess(result.data, meta()));
  } catch (error) {
    Sentry.captureException(error, { extra: { request_id: requestId } });
    return res.status(500).json(
      apiError("SERVER_ERROR", "An unexpected error occurred", undefined, meta())
    );
  }
});

// ─── DELETE /erp/doc ────────────────────────────────────────────────────────────

router.delete("/erp/doc", requireAuth, async (req: Request, res: Response) => {
  const start = Date.now();
  const requestId = getRequestId(req as any);
  const meta = () => apiMeta({ request_id: requestId });
  const responseHeaders = () => ({ "X-Response-Time": `${Date.now() - start}ms` });

  try {
    const session = (req as any).session;
    const ctx = auditContext(req as any);

    // CSRF must be validated before any business logic
    const csrfCookie = req.cookies[CSRF_COOKIE_NAME];
    const csrfHeader = req.headers["x-csrf-token"] as string ?? req.headers["X-CSRF-Token"] as string;
    if (!validateCsrf(csrfHeader, csrfCookie)) {
      void logAudit({
        accountId: session.accountId,
        userId: session.userId,
        action: "erp.doc.delete.csrf_failed",
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        severity: "warn",
        outcome: "failure",
      });
      reportSecurityEvent({
        type: "csrf_attack",
        userId: session.userId,
        accountId: session.accountId,
        ipAddress: ctx.ipAddress,
        details: "CSRF validation failed on erp.doc.delete",
      });
      res.set(responseHeaders());
      return res.status(403).json(
        apiError("FORBIDDEN", "Invalid or missing CSRF token.", undefined, meta())
      );
    }

    if (!session.erpnextSid) {
      res.set(responseHeaders());
      return res.status(401).json(apiError("UNAUTHORIZED", "ERP session not available. Please log in again.", undefined, meta()));
    }

    const rateLimitDelete = await checkTieredRateLimit(getClientIdentifier(req as any), "authenticated", "/api/erp/doc");
    if (!rateLimitDelete.allowed) {
      res.set({ ...responseHeaders(), ...rateLimitHeaders(rateLimitDelete) });
      return res.status(429).json(
        apiError("RATE_LIMIT", "Too many requests. Try again in a minute.", undefined, meta())
      );
    }

    const doctype = req.query.doctype as string | undefined;
    const name = req.query.name as string | undefined;
    if (!doctype || !name) {
      res.set(responseHeaders());
      return res.status(400).json(
        apiError("BAD_REQUEST", "doctype and name required", undefined, meta())
      );
    }

    const ALLOWED_DOCTYPES_DELETE = new Set([
      "Sales Invoice", "Sales Order", "Purchase Invoice", "Purchase Order",
      "Quotation", "Customer", "Supplier", "Item", "Employee",
      "Journal Entry", "Payment Entry", "Stock Entry", "Expense Claim",
      "Leave Application", "Salary Slip", "BOM",
    ]);
    if (!ALLOWED_DOCTYPES_DELETE.has(doctype)) {
      res.set(responseHeaders());
      return res.status(400).json(
        apiError("BAD_REQUEST", "Invalid or unsupported document type", undefined, meta())
      );
    }

    const result = await deleteDoc(doctype, name, session.erpnextSid as string, session.accountId);
    if (!result.ok) {
      res.set(responseHeaders());
      return res.status(502).json(
        apiError("ERP_ERROR", result.error, undefined, meta())
      );
    }
    void logAudit({
      accountId: session.accountId,
      userId: session.userId,
      action: "erp.doc.delete",
      resource: doctype,
      resourceId: name,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      severity: "info",
      outcome: "success",
    });
    res.set(responseHeaders());
    return res.json(apiSuccess(result.data, meta()));
  } catch (error) {
    Sentry.captureException(error, { extra: { request_id: requestId } });
    return res.status(500).json(
      apiError("SERVER_ERROR", "An unexpected error occurred", undefined, meta())
    );
  }
});

// ─── GET /erp/dashboard ────────────────────────────────────────────────────────

router.get("/erp/dashboard", async (req: Request, res: Response) => {
  const start = Date.now();
  const requestId = getRequestId(req as any);
  const meta = () => apiMeta({ request_id: requestId });
  const responseHeaders = () => ({ "X-Response-Time": `${Date.now() - start}ms` });

  try {
    // Session validation
    const token = req.cookies[COOKIE.SESSION_NAME];
    if (!token) {
      res.set(responseHeaders());
      return res.status(401).json(apiError("UNAUTHORIZED", "Not authenticated", undefined, meta()));
    }
    const session = await validateSession(token, req as any);
    if (!session.ok) {
      res.set(responseHeaders());
      return res.status(401).json(apiError("UNAUTHORIZED", session.error, undefined, meta()));
    }

    const rateLimit = await checkTieredRateLimit(getClientIdentifier(req as any), "authenticated", "/api/erp/dashboard");
    if (!rateLimit.allowed) {
      res.set({ ...responseHeaders(), ...rateLimitHeaders(rateLimit) });
      return res.status(429).json(apiError("RATE_LIMIT", "Too many requests", undefined, meta()));
    }

    const { accountId, erpnextSid, userId } = session.data;

    // Fetch account's ERPNext company for multi-tenant scoping
    const account = await prisma.account.findUnique({
      where: { id: accountId },
      select: { erpnextCompany: true },
    });

    const payload = await buildDashboardData(
      erpnextSid ?? userId,
      accountId,
      account?.erpnextCompany ?? null
    );

    res.set(responseHeaders());
    return res.json(apiSuccess(payload, meta()));
  } catch (err) {
    Sentry.captureException(err);
    // Never let the dashboard error — return demo data on unexpected failure
    const requestIdFallback = getRequestId(req as any);
    res.set(responseHeaders());
    return res.json(
      apiSuccess(DEMO_DATA, apiMeta({ request_id: requestIdFallback }))
    );
  }
});

export default router;

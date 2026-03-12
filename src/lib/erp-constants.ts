/**
 * Allowlisted ERPNext document types.
 * Centralised here so erp/list, erp/doc, and workers all share the same list.
 * Add new doctypes here when expanding ERP module support.
 */
export const ALLOWED_DOCTYPES = [
  // ── Sales & CRM ──────────────────────────────────────────────────────────
  "Quotation",
  "Sales Order",
  "Sales Invoice",
  "Customer",
  "Lead",
  "Opportunity",
  "Territory",

  // ── Purchasing ───────────────────────────────────────────────────────────
  "Purchase Order",
  "Purchase Invoice",
  "Purchase Receipt",
  "Supplier",

  // ── Inventory & Stock ────────────────────────────────────────────────────
  "Item",
  "Stock Entry",
  "Warehouse",
  "Stock Reconciliation",
  "Delivery Note",
  "Batch",
  "Serial No",
  "Quality Inspection",

  // ── Accounting & Finance ─────────────────────────────────────────────────
  "Journal Entry",
  "Account",
  "Payment Entry",
  "GL Entry",
  "Budget",
  "Cost Center",
  "Currency Exchange",
  "Company",

  // ── HR ───────────────────────────────────────────────────────────────────
  "Employee",
  "Expense Claim",
  "Leave Application",
  "Attendance",
  "Salary Slip",

  // ── Manufacturing ────────────────────────────────────────────────────────
  "Work Order",
  "BOM",
  "Workstation",
  "Operation",

  // ── Projects ─────────────────────────────────────────────────────────────
  "Project",
  "Task",
  "Timesheet",

  // ── Assets ───────────────────────────────────────────────────────────────
  "Asset",
  "Asset Category",
] as const;

export type AllowedDoctype = (typeof ALLOWED_DOCTYPES)[number];

/** Set form for O(1) lookup — use in route handlers. */
export const ALLOWED_DOCTYPES_SET = new Set<string>(ALLOWED_DOCTYPES);

/** Doctypes that have a `company` field — used for tenant isolation checks. */
export const COMPANY_SCOPED_DOCTYPES = new Set([
  // Sales & CRM
  "Quotation", "Sales Order", "Sales Invoice",
  "Opportunity",
  // Purchasing
  "Purchase Order", "Purchase Invoice", "Purchase Receipt",
  // Inventory
  "Stock Entry", "Stock Reconciliation", "Delivery Note",
  "Quality Inspection",
  // Accounting
  "Journal Entry", "Payment Entry", "GL Entry", "Budget", "Cost Center",
  // HR
  "Employee", "Expense Claim", "Leave Application", "Attendance", "Salary Slip",
  // Manufacturing
  "Work Order", "BOM",
  // Projects
  "Project", "Task", "Timesheet",
  // Assets
  "Asset",
]);

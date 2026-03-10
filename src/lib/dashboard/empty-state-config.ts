/**
 * Standard empty state copy and links for dashboard module pages.
 * Use with EmptyState: pass icon from lucide, and spread or map these fields.
 */

export const MODULE_EMPTY_STATES = {
  invoices: {
    title: "No invoices yet",
    description: "Create your first invoice to start tracking revenue and payments.",
    actionLabel: "Create Invoice",
    actionLink: "/dashboard/invoices?action=new",
  },
  crm: {
    title: "No deals in your pipeline",
    description: "Add your first deal to start tracking your sales pipeline.",
    actionLabel: "Add Deal",
    actionLink: "/dashboard/crm?action=new",
  },
  hr: {
    title: "No employees added",
    description: "Add your team members to manage HR, attendance, and payroll.",
    actionLabel: "Add Employee",
    actionLink: "/dashboard/hr?action=new",
  },
  payroll: {
    title: "No payroll runs yet",
    description: "Set up employees first, then run your first payroll cycle.",
    actionLabel: "Go to HR",
    actionLink: "/dashboard/hr",
  },
  inventory: {
    title: "No stock items",
    description: "Add your products and materials to start tracking inventory.",
    actionLabel: "Add Item",
    actionLink: "/dashboard/inventory?action=new",
  },
  expenses: {
    title: "No expense claims",
    description: "Submit your first expense claim for tracking and approval.",
    actionLabel: "New Claim",
    actionLink: "/dashboard/expenses?action=new",
  },
  procurement: {
    title: "No purchase orders",
    description: "Create a purchase order to manage supplier procurement.",
    actionLabel: "New PO",
    actionLink: "/dashboard/procurement?action=new",
  },
  quotations: {
    title: "No quotations",
    description: "Create a quotation to send professional proposals to clients.",
    actionLabel: "New Quote",
    actionLink: "/dashboard/quotations?action=new",
  },
  accounting: {
    title: "Chart of accounts not configured",
    description: "Set up your chart of accounts to start financial tracking.",
    actionLabel: "Configure",
    actionLink: "/dashboard/settings",
  },
  analytics: {
    title: "Not enough data yet",
    description: "Analytics will populate as you create invoices, deals, and process payroll.",
    actionLabel: "Go to Dashboard",
    actionLink: "/dashboard",
  },
} as const;

export const EMPTY_STATE_SUPPORT_LINE = "Need help? Contact support@westbridge.gy";

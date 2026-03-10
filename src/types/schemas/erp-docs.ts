/**
 * Typed interfaces for common ERPNext doctypes returned by the ERP API.
 * These replace `Record<string, unknown>` casts in dashboard pages.
 */

export interface ErpSalesInvoice {
  name: string;
  customer: string;
  customer_name: string;
  posting_date: string;
  due_date: string;
  grand_total: number;
  outstanding_amount: number;
  status: string;
  currency: string;
}

export interface ErpOpportunity {
  name: string;
  opportunity_from: string;
  party_name: string;
  opportunity_amount: number;
  currency: string;
  status: string;
  expected_closing: string;
  creation: string;
  sales_stage: string;
}

export interface ErpExpenseClaim {
  name: string;
  employee_name: string;
  posting_date: string;
  total_claimed_amount: number;
  total_sanctioned_amount: number;
  status: string;
  expense_type: string;
  currency: string;
}

export interface ErpEmployee {
  name: string;
  employee_name: string;
  designation: string;
  department: string;
  status: string;
  date_of_joining: string;
  company: string;
  cell_phone: string;
  company_email: string;
}

export interface ErpSalarySlip {
  name: string;
  employee_name: string;
  posting_date: string;
  start_date: string;
  end_date: string;
  gross_pay: number;
  total_deduction: number;
  net_pay: number;
  status: string;
  currency: string;
}

export interface ErpStockEntry {
  name: string;
  item_code: string;
  item_name: string;
  warehouse: string;
  actual_qty: number;
  valuation_rate: number;
  stock_value: number;
  stock_uom: string;
}

export interface ErpPurchaseOrder {
  name: string;
  supplier: string;
  supplier_name: string;
  transaction_date: string;
  grand_total: number;
  status: string;
  currency: string;
}

export interface ErpQuotation {
  name: string;
  quotation_to: string;
  party_name: string;
  transaction_date: string;
  valid_till: string;
  grand_total: number;
  status: string;
  currency: string;
}

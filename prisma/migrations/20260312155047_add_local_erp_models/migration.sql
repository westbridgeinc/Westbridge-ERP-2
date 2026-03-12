/*
  Warnings:

  - You are about to drop the column `erpnext_company` on the `accounts` table. All the data in the column will be lost.
  - You are about to drop the column `erpnext_sid` on the `sessions` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "accounts" DROP COLUMN "erpnext_company",
ALTER COLUMN "modules_selected" DROP DEFAULT;

-- AlterTable
ALTER TABLE "sessions" DROP COLUMN "erpnext_sid";

-- CreateTable
CREATE TABLE "doc_name_counters" (
    "id" TEXT NOT NULL,
    "doctype" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "counter" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "doc_name_counters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "erp_customers" (
    "name" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "customer_name" TEXT NOT NULL,
    "customer_type" TEXT,
    "customer_group" TEXT,
    "territory" TEXT,
    "default_currency" TEXT,
    "tax_id" TEXT,
    "email_id" TEXT,
    "mobile_no" TEXT,
    "company" TEXT,
    "owner" TEXT NOT NULL DEFAULT 'System',
    "docstatus" INTEGER NOT NULL DEFAULT 0,
    "creation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modified" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "erp_customers_pkey" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE "erp_suppliers" (
    "name" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "supplier_name" TEXT NOT NULL,
    "supplier_type" TEXT,
    "supplier_group" TEXT,
    "country" TEXT,
    "default_currency" TEXT,
    "tax_id" TEXT,
    "email_id" TEXT,
    "mobile_no" TEXT,
    "company" TEXT,
    "owner" TEXT NOT NULL DEFAULT 'System',
    "docstatus" INTEGER NOT NULL DEFAULT 0,
    "creation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modified" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "erp_suppliers_pkey" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE "erp_leads" (
    "name" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "lead_name" TEXT NOT NULL,
    "company_name" TEXT,
    "email_id" TEXT,
    "mobile_no" TEXT,
    "source" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Open',
    "territory" TEXT,
    "company" TEXT,
    "owner" TEXT NOT NULL DEFAULT 'System',
    "docstatus" INTEGER NOT NULL DEFAULT 0,
    "creation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modified" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "erp_leads_pkey" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE "erp_opportunities" (
    "name" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "party_name" TEXT,
    "opportunity_from" TEXT,
    "opportunity_amount" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'Open',
    "contact_person" TEXT,
    "contact_display" TEXT,
    "currency" TEXT,
    "company" TEXT,
    "owner" TEXT NOT NULL DEFAULT 'System',
    "docstatus" INTEGER NOT NULL DEFAULT 0,
    "creation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modified" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "erp_opportunities_pkey" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE "erp_sales_invoices" (
    "name" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "customer" TEXT,
    "customer_name" TEXT,
    "posting_date" DATE NOT NULL,
    "due_date" DATE,
    "currency" TEXT NOT NULL DEFAULT 'GYD',
    "grand_total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "net_total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "outstanding_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "docstatus" INTEGER NOT NULL DEFAULT 0,
    "company" TEXT,
    "owner" TEXT NOT NULL DEFAULT 'System',
    "creation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modified" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "erp_sales_invoices_pkey" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE "erp_sales_invoice_items" (
    "id" TEXT NOT NULL,
    "parent" TEXT NOT NULL,
    "item_code" TEXT,
    "item_name" TEXT,
    "item_group" TEXT,
    "qty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "erp_sales_invoice_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "erp_sales_orders" (
    "name" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "customer" TEXT,
    "customer_name" TEXT,
    "transaction_date" DATE NOT NULL,
    "delivery_date" DATE,
    "currency" TEXT NOT NULL DEFAULT 'GYD',
    "grand_total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "net_total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "docstatus" INTEGER NOT NULL DEFAULT 0,
    "company" TEXT,
    "owner" TEXT NOT NULL DEFAULT 'System',
    "creation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modified" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "erp_sales_orders_pkey" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE "erp_sales_order_items" (
    "id" TEXT NOT NULL,
    "parent" TEXT NOT NULL,
    "item_code" TEXT,
    "item_name" TEXT,
    "qty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "erp_sales_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "erp_quotations" (
    "name" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "party_name" TEXT,
    "customer_name" TEXT,
    "transaction_date" DATE NOT NULL,
    "valid_till" DATE,
    "currency" TEXT NOT NULL DEFAULT 'GYD',
    "grand_total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "net_total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "docstatus" INTEGER NOT NULL DEFAULT 0,
    "company" TEXT,
    "owner" TEXT NOT NULL DEFAULT 'System',
    "creation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modified" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "erp_quotations_pkey" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE "erp_quotation_items" (
    "id" TEXT NOT NULL,
    "parent" TEXT NOT NULL,
    "item_code" TEXT,
    "item_name" TEXT,
    "qty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "erp_quotation_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "erp_purchase_orders" (
    "name" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "supplier" TEXT,
    "supplier_name" TEXT,
    "transaction_date" DATE NOT NULL,
    "schedule_date" DATE,
    "currency" TEXT NOT NULL DEFAULT 'GYD',
    "grand_total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "net_total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "docstatus" INTEGER NOT NULL DEFAULT 0,
    "company" TEXT,
    "owner" TEXT NOT NULL DEFAULT 'System',
    "creation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modified" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "erp_purchase_orders_pkey" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE "erp_purchase_order_items" (
    "id" TEXT NOT NULL,
    "parent" TEXT NOT NULL,
    "item_code" TEXT,
    "item_name" TEXT,
    "qty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "erp_purchase_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "erp_purchase_invoices" (
    "name" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "supplier" TEXT,
    "supplier_name" TEXT,
    "posting_date" DATE NOT NULL,
    "due_date" DATE,
    "currency" TEXT NOT NULL DEFAULT 'GYD',
    "grand_total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "net_total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "outstanding_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "docstatus" INTEGER NOT NULL DEFAULT 0,
    "company" TEXT,
    "owner" TEXT NOT NULL DEFAULT 'System',
    "creation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modified" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "erp_purchase_invoices_pkey" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE "erp_purchase_receipts" (
    "name" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "supplier" TEXT,
    "supplier_name" TEXT,
    "posting_date" DATE NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'GYD',
    "grand_total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "docstatus" INTEGER NOT NULL DEFAULT 0,
    "company" TEXT,
    "owner" TEXT NOT NULL DEFAULT 'System',
    "creation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modified" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "erp_purchase_receipts_pkey" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE "erp_items" (
    "name" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "item_code" TEXT NOT NULL,
    "item_name" TEXT NOT NULL,
    "item_group" TEXT,
    "stock_uom" TEXT,
    "description" TEXT,
    "valuation_rate" DOUBLE PRECISION,
    "default_warehouse" TEXT,
    "total_projected_qty" DOUBLE PRECISION,
    "owner" TEXT NOT NULL DEFAULT 'System',
    "docstatus" INTEGER NOT NULL DEFAULT 0,
    "creation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modified" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "erp_items_pkey" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE "erp_stock_entries" (
    "name" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "stock_entry_type" TEXT,
    "posting_date" DATE NOT NULL,
    "from_warehouse" TEXT,
    "to_warehouse" TEXT,
    "total_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "docstatus" INTEGER NOT NULL DEFAULT 0,
    "company" TEXT,
    "owner" TEXT NOT NULL DEFAULT 'System',
    "creation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modified" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "erp_stock_entries_pkey" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE "erp_warehouses" (
    "name" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "warehouse_name" TEXT NOT NULL,
    "warehouse_type" TEXT,
    "company" TEXT,
    "is_group" INTEGER NOT NULL DEFAULT 0,
    "parent_warehouse" TEXT,
    "owner" TEXT NOT NULL DEFAULT 'System',
    "creation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modified" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "erp_warehouses_pkey" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE "erp_delivery_notes" (
    "name" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "customer" TEXT,
    "customer_name" TEXT,
    "posting_date" DATE NOT NULL,
    "grand_total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "docstatus" INTEGER NOT NULL DEFAULT 0,
    "company" TEXT,
    "owner" TEXT NOT NULL DEFAULT 'System',
    "creation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modified" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "erp_delivery_notes_pkey" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE "erp_journal_entries" (
    "name" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "posting_date" DATE NOT NULL,
    "voucher_type" TEXT,
    "total_debit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_credit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "remark" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "docstatus" INTEGER NOT NULL DEFAULT 0,
    "company" TEXT,
    "owner" TEXT NOT NULL DEFAULT 'System',
    "creation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modified" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "erp_journal_entries_pkey" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE "erp_accounts" (
    "name" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "account_name" TEXT NOT NULL,
    "parent_account" TEXT,
    "root_type" TEXT,
    "account_type" TEXT,
    "is_group" INTEGER NOT NULL DEFAULT 0,
    "company" TEXT,
    "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "owner" TEXT NOT NULL DEFAULT 'System',
    "creation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modified" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "erp_accounts_pkey" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE "erp_payment_entries" (
    "name" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "posting_date" DATE NOT NULL,
    "payment_type" TEXT,
    "party" TEXT,
    "party_name" TEXT,
    "party_type" TEXT,
    "paid_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "mode_of_payment" TEXT,
    "reference_no" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "docstatus" INTEGER NOT NULL DEFAULT 0,
    "company" TEXT,
    "owner" TEXT NOT NULL DEFAULT 'System',
    "creation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modified" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "erp_payment_entries_pkey" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE "erp_cost_centers" (
    "name" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "cost_center_name" TEXT NOT NULL,
    "parent_cost_center" TEXT,
    "is_group" INTEGER NOT NULL DEFAULT 0,
    "company" TEXT,
    "owner" TEXT NOT NULL DEFAULT 'System',
    "creation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modified" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "erp_cost_centers_pkey" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE "erp_employees" (
    "name" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "employee_name" TEXT NOT NULL,
    "company" TEXT,
    "department" TEXT,
    "designation" TEXT,
    "date_of_joining" DATE,
    "gender" TEXT,
    "date_of_birth" DATE,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "owner" TEXT NOT NULL DEFAULT 'System',
    "creation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modified" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "erp_employees_pkey" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE "erp_expense_claims" (
    "name" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "employee" TEXT,
    "employee_name" TEXT,
    "posting_date" DATE NOT NULL,
    "expense_type" TEXT,
    "total_claimed_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_sanctioned_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "grand_total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "remark" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "docstatus" INTEGER NOT NULL DEFAULT 0,
    "company" TEXT,
    "owner" TEXT NOT NULL DEFAULT 'System',
    "creation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modified" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "erp_expense_claims_pkey" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE "erp_work_orders" (
    "name" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "production_item" TEXT,
    "item_name" TEXT,
    "bom_no" TEXT,
    "qty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "produced_qty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "planned_start_date" DATE,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "docstatus" INTEGER NOT NULL DEFAULT 0,
    "company" TEXT,
    "owner" TEXT NOT NULL DEFAULT 'System',
    "creation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modified" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "erp_work_orders_pkey" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE "erp_boms" (
    "name" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "item" TEXT,
    "item_name" TEXT,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "is_active" INTEGER NOT NULL DEFAULT 1,
    "is_default" INTEGER NOT NULL DEFAULT 0,
    "total_cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "company" TEXT,
    "owner" TEXT NOT NULL DEFAULT 'System',
    "docstatus" INTEGER NOT NULL DEFAULT 0,
    "creation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modified" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "erp_boms_pkey" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE "erp_workstations" (
    "name" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "workstation_name" TEXT NOT NULL,
    "workstation_type" TEXT,
    "production_capacity" DOUBLE PRECISION,
    "description" TEXT,
    "owner" TEXT NOT NULL DEFAULT 'System',
    "creation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modified" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "erp_workstations_pkey" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE "erp_projects" (
    "name" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "project_name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Open',
    "percent_complete" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "expected_start_date" DATE,
    "expected_end_date" DATE,
    "company" TEXT,
    "owner" TEXT NOT NULL DEFAULT 'System',
    "creation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modified" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "erp_projects_pkey" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE "erp_tasks" (
    "name" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "project" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Open',
    "priority" TEXT DEFAULT 'Medium',
    "assigned_to" TEXT,
    "exp_end_date" DATE,
    "company" TEXT,
    "owner" TEXT NOT NULL DEFAULT 'System',
    "creation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modified" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "erp_tasks_pkey" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE "erp_timesheets" (
    "name" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "employee" TEXT,
    "employee_name" TEXT,
    "start_date" DATE,
    "end_date" DATE,
    "total_hours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "docstatus" INTEGER NOT NULL DEFAULT 0,
    "company" TEXT,
    "owner" TEXT NOT NULL DEFAULT 'System',
    "creation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modified" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "erp_timesheets_pkey" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE "erp_assets" (
    "name" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "asset_name" TEXT NOT NULL,
    "asset_category" TEXT,
    "item_code" TEXT,
    "gross_purchase_amount" DOUBLE PRECISION,
    "purchase_date" DATE,
    "location" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "docstatus" INTEGER NOT NULL DEFAULT 0,
    "company" TEXT,
    "owner" TEXT NOT NULL DEFAULT 'System',
    "creation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modified" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "erp_assets_pkey" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE "erp_asset_categories" (
    "name" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "asset_category_name" TEXT NOT NULL,
    "owner" TEXT NOT NULL DEFAULT 'System',
    "creation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modified" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "erp_asset_categories_pkey" PRIMARY KEY ("name")
);

-- CreateIndex
CREATE UNIQUE INDEX "doc_name_counters_doctype_key" ON "doc_name_counters"("doctype");

-- CreateIndex
CREATE INDEX "erp_customers_account_id_idx" ON "erp_customers"("account_id");

-- CreateIndex
CREATE INDEX "erp_customers_account_id_customer_name_idx" ON "erp_customers"("account_id", "customer_name");

-- CreateIndex
CREATE INDEX "erp_suppliers_account_id_idx" ON "erp_suppliers"("account_id");

-- CreateIndex
CREATE INDEX "erp_suppliers_account_id_supplier_name_idx" ON "erp_suppliers"("account_id", "supplier_name");

-- CreateIndex
CREATE INDEX "erp_leads_account_id_idx" ON "erp_leads"("account_id");

-- CreateIndex
CREATE INDEX "erp_leads_account_id_status_idx" ON "erp_leads"("account_id", "status");

-- CreateIndex
CREATE INDEX "erp_opportunities_account_id_idx" ON "erp_opportunities"("account_id");

-- CreateIndex
CREATE INDEX "erp_opportunities_account_id_status_idx" ON "erp_opportunities"("account_id", "status");

-- CreateIndex
CREATE INDEX "erp_sales_invoices_account_id_idx" ON "erp_sales_invoices"("account_id");

-- CreateIndex
CREATE INDEX "erp_sales_invoices_account_id_status_idx" ON "erp_sales_invoices"("account_id", "status");

-- CreateIndex
CREATE INDEX "erp_sales_invoices_account_id_posting_date_idx" ON "erp_sales_invoices"("account_id", "posting_date");

-- CreateIndex
CREATE INDEX "erp_sales_invoice_items_parent_idx" ON "erp_sales_invoice_items"("parent");

-- CreateIndex
CREATE INDEX "erp_sales_orders_account_id_idx" ON "erp_sales_orders"("account_id");

-- CreateIndex
CREATE INDEX "erp_sales_orders_account_id_status_idx" ON "erp_sales_orders"("account_id", "status");

-- CreateIndex
CREATE INDEX "erp_sales_order_items_parent_idx" ON "erp_sales_order_items"("parent");

-- CreateIndex
CREATE INDEX "erp_quotations_account_id_idx" ON "erp_quotations"("account_id");

-- CreateIndex
CREATE INDEX "erp_quotations_account_id_status_idx" ON "erp_quotations"("account_id", "status");

-- CreateIndex
CREATE INDEX "erp_quotation_items_parent_idx" ON "erp_quotation_items"("parent");

-- CreateIndex
CREATE INDEX "erp_purchase_orders_account_id_idx" ON "erp_purchase_orders"("account_id");

-- CreateIndex
CREATE INDEX "erp_purchase_orders_account_id_status_idx" ON "erp_purchase_orders"("account_id", "status");

-- CreateIndex
CREATE INDEX "erp_purchase_order_items_parent_idx" ON "erp_purchase_order_items"("parent");

-- CreateIndex
CREATE INDEX "erp_purchase_invoices_account_id_idx" ON "erp_purchase_invoices"("account_id");

-- CreateIndex
CREATE INDEX "erp_purchase_invoices_account_id_status_idx" ON "erp_purchase_invoices"("account_id", "status");

-- CreateIndex
CREATE INDEX "erp_purchase_invoices_account_id_posting_date_idx" ON "erp_purchase_invoices"("account_id", "posting_date");

-- CreateIndex
CREATE INDEX "erp_purchase_receipts_account_id_idx" ON "erp_purchase_receipts"("account_id");

-- CreateIndex
CREATE INDEX "erp_items_account_id_idx" ON "erp_items"("account_id");

-- CreateIndex
CREATE INDEX "erp_items_account_id_item_group_idx" ON "erp_items"("account_id", "item_group");

-- CreateIndex
CREATE UNIQUE INDEX "erp_items_account_id_item_code_key" ON "erp_items"("account_id", "item_code");

-- CreateIndex
CREATE INDEX "erp_stock_entries_account_id_idx" ON "erp_stock_entries"("account_id");

-- CreateIndex
CREATE INDEX "erp_warehouses_account_id_idx" ON "erp_warehouses"("account_id");

-- CreateIndex
CREATE INDEX "erp_delivery_notes_account_id_idx" ON "erp_delivery_notes"("account_id");

-- CreateIndex
CREATE INDEX "erp_journal_entries_account_id_idx" ON "erp_journal_entries"("account_id");

-- CreateIndex
CREATE INDEX "erp_journal_entries_account_id_posting_date_idx" ON "erp_journal_entries"("account_id", "posting_date");

-- CreateIndex
CREATE INDEX "erp_accounts_account_id_idx" ON "erp_accounts"("account_id");

-- CreateIndex
CREATE INDEX "erp_payment_entries_account_id_idx" ON "erp_payment_entries"("account_id");

-- CreateIndex
CREATE INDEX "erp_payment_entries_account_id_posting_date_idx" ON "erp_payment_entries"("account_id", "posting_date");

-- CreateIndex
CREATE INDEX "erp_cost_centers_account_id_idx" ON "erp_cost_centers"("account_id");

-- CreateIndex
CREATE INDEX "erp_employees_account_id_idx" ON "erp_employees"("account_id");

-- CreateIndex
CREATE INDEX "erp_employees_account_id_status_idx" ON "erp_employees"("account_id", "status");

-- CreateIndex
CREATE INDEX "erp_expense_claims_account_id_idx" ON "erp_expense_claims"("account_id");

-- CreateIndex
CREATE INDEX "erp_expense_claims_account_id_status_idx" ON "erp_expense_claims"("account_id", "status");

-- CreateIndex
CREATE INDEX "erp_work_orders_account_id_idx" ON "erp_work_orders"("account_id");

-- CreateIndex
CREATE INDEX "erp_work_orders_account_id_status_idx" ON "erp_work_orders"("account_id", "status");

-- CreateIndex
CREATE INDEX "erp_boms_account_id_idx" ON "erp_boms"("account_id");

-- CreateIndex
CREATE INDEX "erp_workstations_account_id_idx" ON "erp_workstations"("account_id");

-- CreateIndex
CREATE INDEX "erp_projects_account_id_idx" ON "erp_projects"("account_id");

-- CreateIndex
CREATE INDEX "erp_projects_account_id_status_idx" ON "erp_projects"("account_id", "status");

-- CreateIndex
CREATE INDEX "erp_tasks_account_id_idx" ON "erp_tasks"("account_id");

-- CreateIndex
CREATE INDEX "erp_tasks_account_id_status_idx" ON "erp_tasks"("account_id", "status");

-- CreateIndex
CREATE INDEX "erp_timesheets_account_id_idx" ON "erp_timesheets"("account_id");

-- CreateIndex
CREATE INDEX "erp_assets_account_id_idx" ON "erp_assets"("account_id");

-- CreateIndex
CREATE INDEX "erp_assets_account_id_status_idx" ON "erp_assets"("account_id", "status");

-- CreateIndex
CREATE INDEX "erp_asset_categories_account_id_idx" ON "erp_asset_categories"("account_id");

-- AddForeignKey
ALTER TABLE "erp_sales_invoices" ADD CONSTRAINT "erp_sales_invoices_customer_fkey" FOREIGN KEY ("customer") REFERENCES "erp_customers"("name") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "erp_sales_invoice_items" ADD CONSTRAINT "erp_sales_invoice_items_parent_fkey" FOREIGN KEY ("parent") REFERENCES "erp_sales_invoices"("name") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "erp_sales_orders" ADD CONSTRAINT "erp_sales_orders_customer_fkey" FOREIGN KEY ("customer") REFERENCES "erp_customers"("name") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "erp_sales_order_items" ADD CONSTRAINT "erp_sales_order_items_parent_fkey" FOREIGN KEY ("parent") REFERENCES "erp_sales_orders"("name") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "erp_quotations" ADD CONSTRAINT "erp_quotations_party_name_fkey" FOREIGN KEY ("party_name") REFERENCES "erp_customers"("name") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "erp_quotation_items" ADD CONSTRAINT "erp_quotation_items_parent_fkey" FOREIGN KEY ("parent") REFERENCES "erp_quotations"("name") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "erp_purchase_orders" ADD CONSTRAINT "erp_purchase_orders_supplier_fkey" FOREIGN KEY ("supplier") REFERENCES "erp_suppliers"("name") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "erp_purchase_order_items" ADD CONSTRAINT "erp_purchase_order_items_parent_fkey" FOREIGN KEY ("parent") REFERENCES "erp_purchase_orders"("name") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "erp_purchase_invoices" ADD CONSTRAINT "erp_purchase_invoices_supplier_fkey" FOREIGN KEY ("supplier") REFERENCES "erp_suppliers"("name") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "erp_expense_claims" ADD CONSTRAINT "erp_expense_claims_employee_fkey" FOREIGN KEY ("employee") REFERENCES "erp_employees"("name") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "erp_tasks" ADD CONSTRAINT "erp_tasks_project_fkey" FOREIGN KEY ("project") REFERENCES "erp_projects"("name") ON DELETE SET NULL ON UPDATE CASCADE;

/**
 * Prisma seed script — bootstraps a local dev environment with Caribbean demo data.
 *
 * Run: npx prisma db seed
 *
 * Creates:
 *  - 1 Account (Westbridge Trading Ltd)
 *  - 2 Users (admin + member)
 *  - 5 Customers, 3 Suppliers, 10 Items
 *  - 15 Sales Invoices, 5 Sales Orders, 5 Purchase Orders
 *  - 3 Quotations, 3 Opportunities
 *  - 10 Employees, 5 Expense Claims, 8 Payment Entries
 *  - 3 Journal Entries, 5 Accounts, 3 Cost Centers
 *  - Manufacturing: Work Orders, BOMs, Workstations
 *  - Projects: Projects, Tasks, Timesheets
 *  - Assets: Assets, Asset Categories
 *  - DocNameCounters for all doctypes
 *
 * Idempotent: safe to run multiple times (upserts + deleteMany before re-seeding).
 */

import { PrismaClient } from "@prisma/client";
import { createHash, randomBytes } from "node:crypto";

const prisma = new PrismaClient();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

async function hashPassword(plain: string): Promise<string> {
  try {
    const bcrypt = await import("bcrypt");
    return await bcrypt.hash(plain, 12);
  } catch {
    return sha256(plain);
  }
}

function date(daysAgo: number): Date {
  return new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
}

function dateStr(daysAgo: number): Date {
  const d = date(daysAgo);
  // Return as Date (Prisma handles the conversion)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

// ─── Seed Data ────────────────────────────────────────────────────────────────

const SEED_PASSWORD = "Westbridge@2026#Secure";

async function main() {
  console.log("🌱 Seeding database with Caribbean demo data...\n");

  const passwordHash = await hashPassword(SEED_PASSWORD);

  // 1. Upsert demo account
  const account = await prisma.account.upsert({
    where: { email: "admin@westbridge.gy" },
    update: {
      companyName: "Westbridge Trading Ltd",
      erpnextCompany: "Westbridge Trading Ltd",
      plan: "Business",
      status: "active",
    },
    create: {
      email: "admin@westbridge.gy",
      companyName: "Westbridge Trading Ltd",
      erpnextCompany: "Westbridge Trading Ltd",
      plan: "Business",
      status: "active",
      currency: "GYD",
      country: "GY",
      timezone: "America/Guyana",
      modulesSelected: [
        "invoicing", "crm", "inventory", "expenses", "hr",
        "procurement", "quotations", "accounting", "analytics",
        "manufacturing", "projects", "assets",
      ],
    },
  });

  const ACCT = account.id;
  console.log(`  ✓ Account: ${account.companyName} (${ACCT})`);

  // 2. Users
  const owner = await prisma.user.upsert({
    where: { accountId_email: { accountId: ACCT, email: "admin@westbridge.gy" } },
    update: { name: "Admin User", role: "owner", passwordHash, status: "active" },
    create: { accountId: ACCT, email: "admin@westbridge.gy", name: "Admin User", role: "owner", passwordHash, status: "active" },
  });
  const member = await prisma.user.upsert({
    where: { accountId_email: { accountId: ACCT, email: "member@westbridge.gy" } },
    update: { name: "Team Member", role: "member", passwordHash, status: "active" },
    create: { accountId: ACCT, email: "member@westbridge.gy", name: "Team Member", role: "member", passwordHash, status: "active" },
  });
  console.log(`  ✓ Users:   ${owner.email}, ${member.email}`);

  // 3. Dev session token
  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = sha256(rawToken);
  await prisma.session.upsert({
    where: { token: tokenHash },
    update: {},
    create: {
      userId: owner.id,
      token: tokenHash,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      ipAddress: "127.0.0.1",
      userAgent: "seed-script",
    },
  });

  // ── Clean ALL existing ERP data (seed is a full reset) ──
  const deletions = [
    prisma.salesInvoiceItem.deleteMany(),
    prisma.salesOrderItem.deleteMany(),
    prisma.purchaseOrderItem.deleteMany(),
    prisma.quotationItem.deleteMany(),
  ];
  await Promise.all(deletions);

  await Promise.all([
    prisma.salesInvoice.deleteMany(),
    prisma.salesOrder.deleteMany(),
    prisma.purchaseOrder.deleteMany(),
    prisma.purchaseInvoice.deleteMany(),
    prisma.purchaseReceipt.deleteMany(),
    prisma.quotation.deleteMany(),
    prisma.opportunity.deleteMany(),
    prisma.lead.deleteMany(),
    prisma.paymentEntry.deleteMany(),
    prisma.journalEntry.deleteMany(),
    prisma.expenseClaim.deleteMany(),
    prisma.deliveryNote.deleteMany(),
    prisma.stockEntry.deleteMany(),
    prisma.task.deleteMany(),
    prisma.timesheet.deleteMany(),
    prisma.workOrder.deleteMany(),
    prisma.asset.deleteMany(),
  ]);
  await Promise.all([
    prisma.customer.deleteMany(),
    prisma.supplier.deleteMany(),
    prisma.item.deleteMany(),
    prisma.employee.deleteMany(),
    prisma.erpAccount.deleteMany(),
    prisma.costCenter.deleteMany(),
    prisma.warehouse.deleteMany(),
    prisma.bom.deleteMany(),
    prisma.workstation.deleteMany(),
    prisma.project.deleteMany(),
    prisma.assetCategory.deleteMany(),
    prisma.docNameCounter.deleteMany(),
  ]);
  console.log("  ✓ Cleaned existing ERP data");

  const CO = "Westbridge Trading Ltd";

  // ── Customers ──
  const customers = await Promise.all([
    prisma.customer.create({ data: { name: "CUST-00001", accountId: ACCT, customerName: "Massy Distribution (GY)", customerType: "Company", customerGroup: "Wholesale", territory: "Guyana", defaultCurrency: "GYD", company: CO } }),
    prisma.customer.create({ data: { name: "CUST-00002", accountId: ACCT, customerName: "Banks DIH Limited", customerType: "Company", customerGroup: "Retail", territory: "Guyana", defaultCurrency: "GYD", company: CO } }),
    prisma.customer.create({ data: { name: "CUST-00003", accountId: ACCT, customerName: "Caribbean Trading Co.", customerType: "Company", customerGroup: "Wholesale", territory: "Caribbean", defaultCurrency: "USD", company: CO } }),
    prisma.customer.create({ data: { name: "CUST-00004", accountId: ACCT, customerName: "Demerara Distillers", customerType: "Company", customerGroup: "Manufacturing", territory: "Guyana", defaultCurrency: "GYD", company: CO } }),
    prisma.customer.create({ data: { name: "CUST-00005", accountId: ACCT, customerName: "Republic Bank (GY)", customerType: "Company", customerGroup: "Financial", territory: "Guyana", defaultCurrency: "GYD", company: CO } }),
  ]);
  console.log(`  ✓ Customers: ${customers.length}`);

  // ── Suppliers ──
  const suppliers = await Promise.all([
    prisma.supplier.create({ data: { name: "SUP-00001", accountId: ACCT, supplierName: "National Hardware Ltd", supplierType: "Company", country: "GY", defaultCurrency: "GYD", company: CO } }),
    prisma.supplier.create({ data: { name: "SUP-00002", accountId: ACCT, supplierName: "Guyoil", supplierType: "Company", country: "GY", defaultCurrency: "GYD", company: CO } }),
    prisma.supplier.create({ data: { name: "SUP-00003", accountId: ACCT, supplierName: "Miami Import Group", supplierType: "Company", country: "US", defaultCurrency: "USD", company: CO } }),
  ]);
  console.log(`  ✓ Suppliers: ${suppliers.length}`);

  // ── Items ──
  const items = await Promise.all([
    prisma.item.create({ data: { name: "ITEM-00001", accountId: ACCT, itemCode: "ITEM-00001", itemName: "El Dorado 12 Year Rum", itemGroup: "Beverages", stockUom: "Bottle", valuationRate: 8500, description: "Premium aged rum" } }),
    prisma.item.create({ data: { name: "ITEM-00002", accountId: ACCT, itemCode: "ITEM-00002", itemName: "Demerara Gold Sugar (50kg)", itemGroup: "Commodities", stockUom: "Bag", valuationRate: 4200, description: "Raw cane sugar" } }),
    prisma.item.create({ data: { name: "ITEM-00003", accountId: ACCT, itemCode: "ITEM-00003", itemName: "Coconut Oil (1L)", itemGroup: "Oils & Fats", stockUom: "Bottle", valuationRate: 1800, description: "Virgin coconut oil" } }),
    prisma.item.create({ data: { name: "ITEM-00004", accountId: ACCT, itemCode: "ITEM-00004", itemName: "Rice (25kg)", itemGroup: "Commodities", stockUom: "Bag", valuationRate: 3200, description: "Local white rice" } }),
    prisma.item.create({ data: { name: "ITEM-00005", accountId: ACCT, itemCode: "ITEM-00005", itemName: "Solar Panel 400W", itemGroup: "Equipment", stockUom: "Unit", valuationRate: 125000, description: "Monocrystalline solar panel" } }),
    prisma.item.create({ data: { name: "ITEM-00006", accountId: ACCT, itemCode: "ITEM-00006", itemName: "Timber (Wallaba)", itemGroup: "Building Materials", stockUom: "Board Foot", valuationRate: 2400, description: "Hardwood timber" } }),
    prisma.item.create({ data: { name: "ITEM-00007", accountId: ACCT, itemCode: "ITEM-00007", itemName: "Cassava Flour (5kg)", itemGroup: "Commodities", stockUom: "Bag", valuationRate: 1500, description: "Ground cassava" } }),
    prisma.item.create({ data: { name: "ITEM-00008", accountId: ACCT, itemCode: "ITEM-00008", itemName: "Generator 10kW", itemGroup: "Equipment", stockUom: "Unit", valuationRate: 450000, description: "Diesel generator" } }),
    prisma.item.create({ data: { name: "ITEM-00009", accountId: ACCT, itemCode: "ITEM-00009", itemName: "PPE Kit (Safety)", itemGroup: "Safety", stockUom: "Kit", valuationRate: 8500, description: "Personal protective equipment set" } }),
    prisma.item.create({ data: { name: "ITEM-00010", accountId: ACCT, itemCode: "ITEM-00010", itemName: "Purified Water (5 Gallon)", itemGroup: "Beverages", stockUom: "Gallon", valuationRate: 800, description: "Drinking water" } }),
  ]);
  console.log(`  ✓ Items: ${items.length}`);

  // ── Sales Invoices ──
  const statuses = ["Paid", "Paid", "Paid", "Paid", "Paid", "Paid", "Paid", "Unpaid", "Unpaid", "Unpaid", "Overdue", "Overdue", "Paid", "Paid", "Draft"];
  const invoices = [];
  for (let i = 0; i < 15; i++) {
    const custIdx = i % 5;
    const total = [42000, 18500, 95000, 32000, 250000, 67000, 14500, 85000, 125000, 34000, 18000, 56000, 78000, 45000, 22000][i];
    const outstanding = statuses[i] === "Paid" ? 0 : total;
    const daysAgo = [5, 15, 25, 35, 45, 55, 65, 75, 85, 95, 105, 120, 140, 160, 2][i];
    invoices.push(
      prisma.salesInvoice.create({
        data: {
          name: `SI-${String(i + 1).padStart(5, "0")}`,
          accountId: ACCT,
          customer: customers[custIdx].name,
          customerName: customers[custIdx].customerName,
          postingDate: dateStr(daysAgo),
          dueDate: dateStr(daysAgo - 30),
          currency: "GYD",
          grandTotal: total,
          netTotal: total * 0.86,
          outstandingAmount: outstanding,
          status: statuses[i],
          docstatus: statuses[i] === "Draft" ? 0 : 1,
          company: CO,
          items: {
            create: [
              { itemCode: items[i % 10].itemCode, itemName: items[i % 10].itemName, qty: Math.ceil(total / items[i % 10].valuationRate!), rate: items[i % 10].valuationRate!, amount: total },
            ],
          },
        },
      })
    );
  }
  await Promise.all(invoices);
  console.log(`  ✓ Sales Invoices: 15`);

  // ── Sales Orders ──
  const soStatuses = ["Draft", "To Deliver and Bill", "To Bill", "Completed", "Cancelled"];
  for (let i = 0; i < 5; i++) {
    await prisma.salesOrder.create({
      data: {
        name: `SO-${String(i + 1).padStart(5, "0")}`,
        accountId: ACCT,
        customer: customers[i].name,
        customerName: customers[i].customerName,
        transactionDate: dateStr(i * 10 + 3),
        deliveryDate: dateStr(i * 10 - 7),
        currency: "GYD",
        grandTotal: [65000, 120000, 43000, 88000, 195000][i],
        netTotal: [65000, 120000, 43000, 88000, 195000][i] * 0.86,
        status: soStatuses[i],
        docstatus: i >= 4 ? 2 : 1,
        company: CO,
        items: {
          create: [
            { itemCode: items[i * 2].itemCode, itemName: items[i * 2].itemName, qty: 10, rate: items[i * 2].valuationRate!, amount: items[i * 2].valuationRate! * 10 },
          ],
        },
      },
    });
  }
  console.log(`  ✓ Sales Orders: 5`);

  // ── Purchase Orders ──
  for (let i = 0; i < 5; i++) {
    const supIdx = i % 3;
    await prisma.purchaseOrder.create({
      data: {
        name: `PO-${String(i + 1).padStart(5, "0")}`,
        accountId: ACCT,
        supplier: suppliers[supIdx].name,
        supplierName: suppliers[supIdx].supplierName,
        transactionDate: dateStr(i * 12 + 5),
        currency: "GYD",
        grandTotal: [85000, 240000, 35000, 67000, 180000][i],
        netTotal: [85000, 240000, 35000, 67000, 180000][i] * 0.86,
        status: ["To Receive", "Completed", "To Receive", "Draft", "Completed"][i],
        docstatus: i === 3 ? 0 : 1,
        company: CO,
        items: {
          create: [
            { itemCode: items[i + 5].itemCode, itemName: items[i + 5].itemName, qty: 50, rate: items[i + 5].valuationRate!, amount: items[i + 5].valuationRate! * 50 },
          ],
        },
      },
    });
  }
  console.log(`  ✓ Purchase Orders: 5`);

  // ── Purchase Invoices ──
  for (let i = 0; i < 5; i++) {
    const supIdx = i % 3;
    await prisma.purchaseInvoice.create({
      data: {
        name: `PI-${String(i + 1).padStart(5, "0")}`,
        accountId: ACCT,
        supplier: suppliers[supIdx].name,
        supplierName: suppliers[supIdx].supplierName,
        postingDate: dateStr(i * 15 + 10),
        currency: "GYD",
        grandTotal: [75000, 190000, 42000, 58000, 135000][i],
        netTotal: [75000, 190000, 42000, 58000, 135000][i] * 0.86,
        outstandingAmount: i < 3 ? 0 : [75000, 190000, 42000, 58000, 135000][i],
        status: ["Paid", "Paid", "Paid", "Unpaid", "Overdue"][i],
        docstatus: 1,
        company: CO,
      },
    });
  }
  console.log(`  ✓ Purchase Invoices: 5`);

  // ── Quotations ──
  for (let i = 0; i < 3; i++) {
    await prisma.quotation.create({
      data: {
        name: `QTN-${String(i + 1).padStart(5, "0")}`,
        accountId: ACCT,
        partyName: customers[i].name,
        customerName: customers[i].customerName,
        transactionDate: dateStr(i * 7 + 2),
        validTill: dateStr(i * 7 - 28),
        currency: "GYD",
        grandTotal: [120000, 350000, 85000][i],
        netTotal: [120000, 350000, 85000][i] * 0.86,
        status: ["Open", "Ordered", "Lost"][i],
        docstatus: 1,
        company: CO,
        items: {
          create: [
            { itemCode: items[i].itemCode, itemName: items[i].itemName, qty: 25, rate: items[i].valuationRate!, amount: items[i].valuationRate! * 25 },
          ],
        },
      },
    });
  }
  console.log(`  ✓ Quotations: 3`);

  // ── Opportunities ──
  for (let i = 0; i < 3; i++) {
    await prisma.opportunity.create({
      data: {
        name: `OPP-${String(i + 1).padStart(5, "0")}`,
        accountId: ACCT,
        partyName: customers[i + 2].customerName,
        opportunityFrom: "Customer",
        opportunityAmount: [500000, 1200000, 250000][i],
        status: ["Open", "Replied", "Converted"][i],
        currency: "GYD",
        company: CO,
      },
    });
  }
  console.log(`  ✓ Opportunities: 3`);

  // ── Leads ──
  for (let i = 0; i < 3; i++) {
    await prisma.lead.create({
      data: {
        name: `LEAD-${String(i + 1).padStart(5, "0")}`,
        accountId: ACCT,
        leadName: ["John Persaud", "Maria Da Silva", "David Fernandes"][i],
        companyName: ["Stabroek Imports", "New Amsterdam Hardware", "Berbice Wholesale"][i],
        emailId: [`john@stabroek.gy`, `maria@newamsterdam.gy`, `david@berbice.gy`][i],
        source: ["Website", "Referral", "Cold Call"][i],
        status: ["Open", "Replied", "Converted"][i],
        territory: "Guyana",
        company: CO,
      },
    });
  }
  console.log(`  ✓ Leads: 3`);

  // ── Employees ──
  const empDepts = ["Operations", "Finance", "Sales", "HR", "IT", "Logistics", "Sales", "Finance", "Operations", "Management"];
  const empNames = [
    "Rajesh Persaud", "Shanta Ramdass", "Michael Chen", "Alisha Mohammed",
    "David Singh", "Keisha Williams", "Andre Thomas", "Priya Narine",
    "Ryan Baptiste", "Carol Peters",
  ];
  const empStatuses = ["Active", "Active", "Active", "Active", "Active", "Active", "Active", "Active", "Active", "Left"];
  for (let i = 0; i < 10; i++) {
    await prisma.employee.create({
      data: {
        name: `EMP-${String(i + 1).padStart(5, "0")}`,
        accountId: ACCT,
        employeeName: empNames[i],
        company: CO,
        department: empDepts[i],
        designation: ["Manager", "Accountant", "Sales Rep", "HR Officer", "Developer", "Driver", "Sales Rep", "Clerk", "Supervisor", "Director"][i],
        dateOfJoining: dateStr([365, 730, 1095, 180, 90, 400, 60, 545, 200, 1460][i]),
        gender: ["Male", "Female", "Male", "Female", "Male", "Female", "Male", "Female", "Male", "Female"][i],
        status: empStatuses[i],
      },
    });
  }
  console.log(`  ✓ Employees: 10`);

  // ── Expense Claims ──
  for (let i = 0; i < 5; i++) {
    await prisma.expenseClaim.create({
      data: {
        name: `EXP-${String(i + 1).padStart(5, "0")}`,
        accountId: ACCT,
        employee: `EMP-${String(i + 1).padStart(5, "0")}`,
        employeeName: empNames[i],
        postingDate: dateStr(i * 14 + 3),
        expenseType: ["Travel", "Office Supplies", "Client Entertainment", "Fuel", "Training"][i],
        totalClaimedAmount: [25000, 12000, 45000, 8500, 35000][i],
        totalSanctionedAmount: [25000, 12000, 40000, 8500, 35000][i],
        grandTotal: [25000, 12000, 40000, 8500, 35000][i],
        status: ["Approved", "Approved", "Rejected", "Draft", "Approved"][i],
        docstatus: i === 3 ? 0 : 1,
        company: CO,
      },
    });
  }
  console.log(`  ✓ Expense Claims: 5`);

  // ── Payment Entries ──
  for (let i = 0; i < 8; i++) {
    await prisma.paymentEntry.create({
      data: {
        name: `PAY-${String(i + 1).padStart(5, "0")}`,
        accountId: ACCT,
        postingDate: dateStr(i * 8 + 2),
        paymentType: i < 5 ? "Receive" : "Pay",
        party: i < 5 ? customers[i % 5].name : suppliers[i % 3].name,
        partyName: i < 5 ? customers[i % 5].customerName : suppliers[i % 3].supplierName,
        partyType: i < 5 ? "Customer" : "Supplier",
        paidAmount: [42000, 18500, 95000, 32000, 67000, 85000, 240000, 35000][i],
        modeOfPayment: ["Bank Transfer", "Cash", "Bank Transfer", "Cheque", "Bank Transfer", "Bank Transfer", "Bank Transfer", "Cash"][i],
        status: "Submitted",
        docstatus: 1,
        company: CO,
      },
    });
  }
  console.log(`  ✓ Payment Entries: 8`);

  // ── Journal Entries ──
  for (let i = 0; i < 3; i++) {
    await prisma.journalEntry.create({
      data: {
        name: `JE-${String(i + 1).padStart(5, "0")}`,
        accountId: ACCT,
        postingDate: dateStr(i * 20 + 5),
        voucherType: ["Journal Entry", "Bank Entry", "Cash Entry"][i],
        totalDebit: [150000, 85000, 42000][i],
        totalCredit: [150000, 85000, 42000][i],
        remark: ["Monthly depreciation", "Bank charges Q1", "Petty cash replenishment"][i],
        status: "Submitted",
        docstatus: 1,
        company: CO,
      },
    });
  }
  console.log(`  ✓ Journal Entries: 3`);

  // ── Accounts (Chart of Accounts) ──
  const accounts = [
    { name: "ACC-00001", accountName: "Cash", rootType: "Asset", accountType: "Cash", balance: 1250000 },
    { name: "ACC-00002", accountName: "Accounts Receivable", rootType: "Asset", accountType: "Receivable", balance: 458000 },
    { name: "ACC-00003", accountName: "Sales Revenue", rootType: "Income", accountType: "Income Account", balance: 3200000 },
    { name: "ACC-00004", accountName: "Cost of Goods Sold", rootType: "Expense", accountType: "Expense Account", balance: 1890000 },
    { name: "ACC-00005", accountName: "Accounts Payable", rootType: "Liability", accountType: "Payable", balance: 325000 },
  ];
  for (const acc of accounts) {
    await prisma.erpAccount.create({
      data: { ...acc, accountId: ACCT, company: CO },
    });
  }
  console.log(`  ✓ Accounts: ${accounts.length}`);

  // ── Cost Centers ──
  for (let i = 0; i < 3; i++) {
    await prisma.costCenter.create({
      data: {
        name: `CC-${String(i + 1).padStart(5, "0")}`,
        accountId: ACCT,
        costCenterName: ["Main", "Georgetown Branch", "Linden Branch"][i],
        company: CO,
      },
    });
  }
  console.log(`  ✓ Cost Centers: 3`);

  // ── Warehouses ──
  for (let i = 0; i < 3; i++) {
    await prisma.warehouse.create({
      data: {
        name: `WH-${String(i + 1).padStart(5, "0")}`,
        accountId: ACCT,
        warehouseName: ["Main Warehouse", "Georgetown Store", "Linden Depot"][i],
        warehouseType: ["Warehouse", "Store", "Depot"][i],
        company: CO,
      },
    });
  }
  console.log(`  ✓ Warehouses: 3`);

  // ── Delivery Notes ──
  for (let i = 0; i < 3; i++) {
    await prisma.deliveryNote.create({
      data: {
        name: `DN-${String(i + 1).padStart(5, "0")}`,
        accountId: ACCT,
        customer: customers[i].name,
        customerName: customers[i].customerName,
        postingDate: dateStr(i * 10 + 5),
        grandTotal: [42000, 95000, 32000][i],
        status: ["Completed", "To Bill", "Draft"][i],
        docstatus: i === 2 ? 0 : 1,
        company: CO,
      },
    });
  }
  console.log(`  ✓ Delivery Notes: 3`);

  // ── Manufacturing ──
  // Workstations
  for (let i = 0; i < 2; i++) {
    await prisma.workstation.create({
      data: {
        name: `WS-${String(i + 1).padStart(5, "0")}`,
        accountId: ACCT,
        workstationName: ["Assembly Line A", "Packaging Station"][i],
        workstationType: ["Assembly", "Packaging"][i],
        productionCapacity: [100, 200][i],
      },
    });
  }

  // BOMs
  for (let i = 0; i < 2; i++) {
    await prisma.bom.create({
      data: {
        name: `BOM-${String(i + 1).padStart(5, "0")}`,
        accountId: ACCT,
        item: items[i].itemCode,
        itemName: items[i].itemName,
        quantity: 1,
        isActive: 1,
        isDefault: i === 0 ? 1 : 0,
        totalCost: items[i].valuationRate! * 0.8,
        company: CO,
        docstatus: 1,
      },
    });
  }

  // Work Orders
  for (let i = 0; i < 3; i++) {
    await prisma.workOrder.create({
      data: {
        name: `WO-${String(i + 1).padStart(5, "0")}`,
        accountId: ACCT,
        productionItem: items[i].itemCode,
        itemName: items[i].itemName,
        bom: `BOM-${String((i % 2) + 1).padStart(5, "0")}`,
        qty: [100, 50, 200][i],
        producedQty: [100, 25, 0][i],
        plannedStartDate: dateStr(i * 15),
        status: ["Completed", "In Process", "Not Started"][i],
        docstatus: 1,
        company: CO,
      },
    });
  }
  console.log(`  ✓ Manufacturing: 2 Workstations, 2 BOMs, 3 Work Orders`);

  // ── Projects ──
  for (let i = 0; i < 2; i++) {
    await prisma.project.create({
      data: {
        name: `PROJ-${String(i + 1).padStart(5, "0")}`,
        accountId: ACCT,
        projectName: ["Warehouse Expansion", "ERP Implementation"][i],
        status: ["Open", "Completed"][i],
        percentComplete: [45, 100][i],
        expectedStartDate: dateStr([90, 180][i]),
        expectedEndDate: dateStr([0, 30][i]),
        company: CO,
      },
    });
  }

  // Tasks
  for (let i = 0; i < 4; i++) {
    await prisma.task.create({
      data: {
        name: `TASK-${String(i + 1).padStart(5, "0")}`,
        accountId: ACCT,
        subject: ["Foundation work", "Roof installation", "Data migration", "User training"][i],
        project: i < 2 ? "PROJ-00001" : "PROJ-00002",
        status: ["Completed", "Working", "Completed", "Open"][i],
        priority: ["High", "High", "Medium", "Low"][i],
        expEndDate: dateStr(i * 10),
        company: CO,
      },
    });
  }

  // Timesheets
  for (let i = 0; i < 3; i++) {
    await prisma.timesheet.create({
      data: {
        name: `TS-${String(i + 1).padStart(5, "0")}`,
        accountId: ACCT,
        employee: `EMP-${String(i + 1).padStart(5, "0")}`,
        employeeName: empNames[i],
        startDate: dateStr(i * 7 + 7),
        endDate: dateStr(i * 7),
        totalHours: [40, 35, 42][i],
        status: ["Submitted", "Draft", "Submitted"][i],
        docstatus: i === 1 ? 0 : 1,
        company: CO,
      },
    });
  }
  console.log(`  ✓ Projects: 2 Projects, 4 Tasks, 3 Timesheets`);

  // ── Assets ──
  await prisma.assetCategory.create({
    data: { name: "ACAT-00001", accountId: ACCT, assetCategoryName: "Vehicles" },
  });
  await prisma.assetCategory.create({
    data: { name: "ACAT-00002", accountId: ACCT, assetCategoryName: "Office Equipment" },
  });
  await prisma.assetCategory.create({
    data: { name: "ACAT-00003", accountId: ACCT, assetCategoryName: "Machinery" },
  });

  for (let i = 0; i < 3; i++) {
    await prisma.asset.create({
      data: {
        name: `AST-${String(i + 1).padStart(5, "0")}`,
        accountId: ACCT,
        assetName: ["Toyota Hilux", "HP Laptop x5", "Forklift CAT"][i],
        assetCategory: ["Vehicles", "Office Equipment", "Machinery"][i],
        grossPurchaseAmount: [12000000, 1500000, 8500000][i],
        purchaseDate: dateStr([365, 180, 730][i]),
        location: ["Georgetown", "Head Office", "Warehouse"][i],
        status: ["Submitted", "Submitted", "Draft"][i],
        docstatus: i === 2 ? 0 : 1,
        company: CO,
      },
    });
  }
  console.log(`  ✓ Assets: 3 Categories, 3 Assets`);

  // ── DocNameCounters ──
  const counters = [
    { doctype: "Sales Invoice", prefix: "SI", counter: 15 },
    { doctype: "Sales Order", prefix: "SO", counter: 5 },
    { doctype: "Purchase Order", prefix: "PO", counter: 5 },
    { doctype: "Purchase Invoice", prefix: "PI", counter: 5 },
    { doctype: "Purchase Receipt", prefix: "PR", counter: 0 },
    { doctype: "Quotation", prefix: "QTN", counter: 3 },
    { doctype: "Customer", prefix: "CUST", counter: 5 },
    { doctype: "Supplier", prefix: "SUP", counter: 3 },
    { doctype: "Item", prefix: "ITEM", counter: 10 },
    { doctype: "Employee", prefix: "EMP", counter: 10 },
    { doctype: "Expense Claim", prefix: "EXP", counter: 5 },
    { doctype: "Payment Entry", prefix: "PAY", counter: 8 },
    { doctype: "Opportunity", prefix: "OPP", counter: 3 },
    { doctype: "Lead", prefix: "LEAD", counter: 3 },
    { doctype: "Journal Entry", prefix: "JE", counter: 3 },
    { doctype: "Account", prefix: "ACC", counter: 5 },
    { doctype: "Cost Center", prefix: "CC", counter: 3 },
    { doctype: "Stock Entry", prefix: "STE", counter: 0 },
    { doctype: "Warehouse", prefix: "WH", counter: 3 },
    { doctype: "Delivery Note", prefix: "DN", counter: 3 },
    { doctype: "Work Order", prefix: "WO", counter: 3 },
    { doctype: "BOM", prefix: "BOM", counter: 2 },
    { doctype: "Workstation", prefix: "WS", counter: 2 },
    { doctype: "Project", prefix: "PROJ", counter: 2 },
    { doctype: "Task", prefix: "TASK", counter: 4 },
    { doctype: "Timesheet", prefix: "TS", counter: 3 },
    { doctype: "Asset", prefix: "AST", counter: 3 },
    { doctype: "Asset Category", prefix: "ACAT", counter: 3 },
  ];
  for (const c of counters) {
    await prisma.docNameCounter.upsert({
      where: { doctype: c.doctype },
      update: { counter: c.counter },
      create: c,
    });
  }
  console.log(`  ✓ DocNameCounters: ${counters.length}`);

  // ── Audit log ──
  await prisma.auditLog.create({
    data: {
      accountId: ACCT,
      userId: owner.id,
      action: "seed.complete",
      resource: "system",
      metadata: {
        seedVersion: "2.0.0",
        caribbeanDefaults: {
          currency: "GYD",
          vatRate: 0.14,
          nisEmployerRate: 0.088,
          nisEmployeeRate: 0.056,
          nisCeiling: 280_000,
          payeThreshold: 780_000,
        },
      },
      severity: "info",
      outcome: "success",
    },
  });

  console.log("\n─── Seed Summary ────────────────────────────────────────────");
  console.log(`  Account:    ${account.companyName}`);
  console.log(`  Currency:   GYD (Guyanese Dollar)`);
  console.log(`  Country:    GY (Guyana)`);
  console.log(`  Timezone:   America/Guyana`);
  console.log(`  Modules:    12 enabled`);
  console.log(`  Users:      admin@westbridge.gy / ${SEED_PASSWORD}`);
  console.log(`              member@westbridge.gy / ${SEED_PASSWORD}`);
  console.log(`  Documents:  15 Invoices, 5 SO, 5 PO, 5 PI, 3 QTN, 3 OPP`);
  console.log(`              10 Employees, 5 Expenses, 8 Payments`);
  console.log(`              3 WO, 2 BOM, 2 Projects, 3 Assets`);
  console.log("─────────────────────────────────────────────────────────────\n");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

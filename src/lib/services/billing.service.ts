/**
 * Billing service: signup (create account + payment link), IPN handling.
 */

import { prisma } from "../data/prisma.js";
import {
  getPaymentLinkUrl,
  verifyIPNSignature,
  isIPNSuccess,
  type PlanSlug,
} from "../data/twocheckout.client.js";
import { ok, err, type Result } from "../utils/result.js";
import { sendEmail } from "../email/index.js";
import { accountActivatedEmail } from "../email/templates.js";

const VALID_PLANS: PlanSlug[] = ["Starter", "Business", "Enterprise"];

export interface CreateAccountInput {
  email: string;
  companyName: string;
  plan: string;
  modulesSelected?: string[];
}

export interface CreateAccountResult {
  accountId: string;
  paymentUrl: string | null;
  status: "pending";
  message?: string;
}

export async function createAccount(
  input: CreateAccountInput,
  returnBaseUrl: string
): Promise<Result<CreateAccountResult, string>> {
  const { email, companyName, plan, modulesSelected } = input;
  if (!email?.trim() || !companyName?.trim() || !plan?.trim()) {
    return err("Email, company name, and plan are required");
  }
  const planSlug = plan as PlanSlug;
  if (!VALID_PLANS.includes(planSlug)) {
    return err("Invalid plan");
  }

  try {
    const account = await prisma.$transaction(async (tx) => {
      const existing = await tx.account.findUnique({ where: { email: email.trim() } });
      if (existing) {
        if (existing.status === "active") {
          throw new Error("An account with this email already exists. Please sign in.");
        }
        await tx.account.delete({ where: { email: email.trim() } });
      }
      return tx.account.create({
        data: {
          email: email.trim(),
          companyName: companyName.trim(),
          plan: planSlug,
          modulesSelected: Array.isArray(modulesSelected) ? modulesSelected : [],
          status: "pending",
        },
      });
    });

    const returnUrl = `${returnBaseUrl}/signup?success=true&accountId=${account.id}`;
    const paymentUrl = getPaymentLinkUrl(planSlug, account.id, returnUrl);

    return ok({
      accountId: account.id,
      paymentUrl: paymentUrl || null,
      status: "pending" as const,
      ...(paymentUrl ? {} : { message: "Account created. Payment link not configured; contact support to complete." }),
    });
  } catch (e) {
    return err(e instanceof Error ? e.message : "Failed to create account");
  }
}

export interface HandleIPNResult {
  updated: boolean;
  accountId?: string;
}

export function verifyIPN(params: Record<string, string | undefined>): boolean {
  return verifyIPNSignature(params);
}

export function isPaymentSuccess(params: Record<string, string | undefined>): boolean {
  return isIPNSuccess(params);
}

export async function markAccountPaid(
  accountId: string,
  twocoOrderId?: string,
  twocoCustomerId?: string
): Promise<Result<HandleIPNResult, string>> {
  try {
    const result = await prisma.account.updateMany({
      where: { id: accountId },
      data: {
        status: "active",
        twocoOrderId: twocoOrderId ?? undefined,
        twocoCustomerId: twocoCustomerId ?? undefined,
      },
    });
    const updated = (result.count ?? 0) > 0;
    if (updated) {
      // Send activation email (fire-and-forget — don't fail if email fails)
      const account = await prisma.account.findUnique({ where: { id: accountId } }).catch(() => null);
      if (account) {
        const loginUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/login`;
        void sendEmail({
          to: account.email,
          subject: "Your Westbridge account is now active",
          html: accountActivatedEmail({ companyName: account.companyName, plan: account.plan, loginUrl }),
        });
      }
    }
    return ok({ updated, accountId });
  } catch (e) {
    return err(e instanceof Error ? e.message : "Failed to mark account as paid");
  }
}

/**
 * ERP service: list and doc operations. Delegates to data layer.
 */

import {
  erpList,
  erpGet,
  erpCreate,
  erpUpdate,
  type ListParams,
} from "../data/erpnext.client.js";
import type { Result } from "../utils/result.js";

/**
 * List ERP documents. erpnextCompany scopes results to that company (row-level security).
 */
export async function list(
  doctype: string,
  sessionId: string,
  params?: ListParams,
  accountId?: string,
  erpnextCompany?: string | null
): Promise<Result<unknown[], string>> {
  if (!doctype?.trim()) return { ok: false, error: "doctype required" };
  return erpList(doctype, sessionId, params, accountId, erpnextCompany);
}

export async function getDoc(
  doctype: string,
  name: string,
  sessionId: string,
  accountId?: string
): Promise<Result<unknown, string>> {
  if (!doctype?.trim() || !name?.trim()) return { ok: false, error: "doctype and name required" };
  return erpGet(doctype, name, sessionId, accountId);
}

export async function createDoc(
  doctype: string,
  sessionId: string,
  body: Record<string, unknown>,
  accountId?: string
): Promise<Result<unknown, string>> {
  if (!doctype?.trim()) return { ok: false, error: "doctype required" };
  return erpCreate(doctype, sessionId, body, accountId);
}

export async function updateDoc(
  doctype: string,
  name: string,
  sessionId: string,
  updates: Record<string, unknown>,
  accountId?: string
): Promise<Result<unknown, string>> {
  if (!doctype?.trim() || !name?.trim()) return { ok: false, error: "doctype and name required" };
  return erpUpdate(doctype, name, sessionId, updates, accountId);
}

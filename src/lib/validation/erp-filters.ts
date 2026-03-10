/**
 * ERP filter validation.
 */

export function validateErpFilters(raw: string | undefined): { ok: boolean; filters: unknown[]; error?: string } {
  if (!raw) return { ok: true, filters: [] };
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return { ok: false, filters: [], error: "Filters must be an array" };
    return { ok: true, filters: parsed };
  } catch {
    return { ok: false, filters: [], error: "Invalid JSON in filters parameter" };
  }
}

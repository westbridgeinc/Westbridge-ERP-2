/**
 * Result type for service layer. No thrown exceptions for expected failures.
 */

export type Result<T, E = Error> =
  | { ok: true; data: T }
  | { ok: false; error: E };

/** Structured error for service/data layers. Use instead of plain strings for richer context. */
export interface AppError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export function ok<T>(data: T): Result<T, never> {
  return { ok: true, data };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

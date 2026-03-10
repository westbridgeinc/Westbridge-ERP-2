export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validates password against SOC 2 policy (min length, complexity).
 * Actual authentication is performed by ERPNext; this is a client-side pre-check
 * so users get immediate feedback (e.g. in change-password or invite flows).
 */
export function validatePassword(password: string): PasswordValidationResult {
  const errors: string[] = [];

  if (password.length < 10) errors.push("Must be at least 10 characters");
  if (password.length > 128) errors.push("Must be at most 128 characters");
  if (!/[A-Z]/.test(password)) errors.push("Must contain an uppercase letter");
  if (!/[a-z]/.test(password)) errors.push("Must contain a lowercase letter");
  if (!/[0-9]/.test(password)) errors.push("Must contain a number");
  if (!/[^A-Za-z0-9]/.test(password)) errors.push("Must contain a special character");

  return { valid: errors.length === 0, errors };
}
